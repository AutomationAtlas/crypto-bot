import { WebSocketServer, WebSocket } from "ws";
import { trader } from "../trader";
import { riskEngine, checkExits, RiskRule } from "../risk";
import { liveConfig } from "../config/configStore";
import { getAllPrices, getAllPriceData, tick } from "../priceFeed";
import { logger } from "../logger";
import { notify } from "../telegram";

const MTM_INTERVAL_MS        = 5_000;
const EXIT_CHECK_INTERVAL_MS = 1_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCryptoPrice(p: number, instrument: string): string {
  // XRP uses 4dp; BTC/ETH/SOL/BNB use 2dp
  return instrument.startsWith("XRP") ? p.toFixed(4) : p.toFixed(2);
}

let _wss: WebSocketServer | null = null;

// ─── Shared broadcast helpers ─────────────────────────────────────────────────

function broadcast(message: object): void {
  if (!_wss) return;
  const json = JSON.stringify(message);
  for (const client of _wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  }
}

// ─── Event payload types ──────────────────────────────────────────────────────

export interface RiskEventPayload {
  rule: RiskRule;
  message: string;
  symbol?: string;
  [key: string]: unknown;
}

export function broadcastRiskEvent(payload: RiskEventPayload): void {
  broadcast({ type: "risk_event", data: { ...payload, timestamp: new Date().toISOString() } });

  const { rule, symbol, price, pct } = payload as RiskEventPayload & { price?: number; pct?: number };
  const sym  = symbol ?? "?";
  const p    = typeof price === "number" ? fmtCryptoPrice(price, sym) : "?";
  const pAbs = typeof pct   === "number" ? Math.abs(pct).toFixed(3) : "?";

  if      (rule === "TP1")              notify(`✅ TP1 ${sym} @ ${p} | +${pAbs}%`);
  else if (rule === "TP2")              notify(`✅ TP2 ${sym} @ ${p} | +${pAbs}%`);
  else if ((rule as string) === "SL")   notify(`🔴 SL ${sym} @ ${p} | -${pAbs}%`);
  else if (rule === "GAP_STOP")         notify(`🔴 GAP STOP ${sym} @ ${p} | -${pAbs}%`);
  else if (rule === "RUNNER")           notify(`🏁 RUNNER ${sym} @ ${p} | +${pAbs}%`);
  else if (rule === "DAILY_LOSS_LIMIT") notify(`⚠️ DAILY LOSS CAP REACHED — bot halted`);
}

export interface StrategyEventPayload {
  symbol: string;
  signal: "BREAKOUT" | "NONE";
  action: "BOUGHT" | "BLOCKED" | "SKIPPED";
  detail: string;
  price: number;
  size?: number;
}

export function broadcastStrategyEvent(payload: StrategyEventPayload): void {
  broadcast({ type: "strategy_event", data: { ...payload, timestamp: new Date().toISOString() } });

  if (payload.action === "BOUGHT") {
    const sizeStr = typeof payload.size === "number" ? `$${payload.size.toFixed(2)}` : "?";
    notify(`🟢 BUY ${payload.symbol} @ ${fmtCryptoPrice(payload.price, payload.symbol)} | Size: ${sizeStr}`);
  }
}

export function broadcastConsecutiveLossPause(n: number, pauseMin: number): void {
  notify(`⚠️ ${n} consecutive losses — strategy paused ${pauseMin} min`);
}

// ─── Exit check (runs every 1 s) ──────────────────────────────────────────────

function runExitChecks(): void {
  const snapshot = trader.getSnapshot();
  let anyExited  = false;

  for (const pos of snapshot.positions) {
    const signals = checkExits(pos);

    for (const signal of signals) {
      const freshSnap   = trader.getSnapshot();
      const currentPos  = freshSnap.positions.find((p) => p.symbol === pos.symbol);
      if (!currentPos) break;

      let result: ReturnType<typeof trader.sell> | ReturnType<typeof trader.partialSell>;

      if (signal.qtyPct >= 1) {
        result = trader.sell(currentPos.symbol, currentPos.qty, currentPos.currentPrice, signal.type);
      } else {
        result = trader.partialSell(
          currentPos.symbol,
          signal.qtyPct,
          currentPos.currentPrice,
          signal.type,
          signal.moveSL ?? false,
        );
      }

      if (result.ok) {
        if (signal.type === "SL") trader.recordStopOut(pos.symbol);
        const exitPrice = currentPos.currentPrice;
        const exitPct   = pos.entryPrice > 0
          ? ((exitPrice - pos.entryPrice) / pos.entryPrice) * 100
          : 0;
        const payload: RiskEventPayload = {
          rule:    signal.type as RiskRule,
          symbol:  pos.symbol,
          message: signal.reason,
          tradeId: result.trade.id,
          price:   exitPrice,
          pct:     exitPct,
        };
        broadcastRiskEvent(payload);
        logger.warn("risk_event", { rule: signal.type, symbol: pos.symbol, message: signal.reason, tradeId: result.trade.id });
        anyExited = true;
      }
    }
  }

  if (anyExited) {
    broadcast({ type: "mtm_update", data: trader.getSnapshot() });
  }
}

// ─── Broadcaster init ─────────────────────────────────────────────────────────

export function initBroadcaster(wss: WebSocketServer): void {
  _wss = wss;

  setInterval(runExitChecks, EXIT_CHECK_INTERVAL_MS);

  setInterval(() => {
    tick(); // no-op in production; priceFeed has its own poller

    // Update peak prices for trailing stop
    trader.tickPositions(getAllPrices());

    // ── Daily loss cap ────────────────────────────────────────────────────────
    const snap     = trader.getSnapshot();
    const dailyLoss = snap.portfolioValue - riskEngine.sessionOpenValue;
    if (
      !riskEngine.isHalted() &&
      dailyLoss < 0 &&
      Math.abs(dailyLoss) >= riskEngine.sessionOpenValue * liveConfig.riskDailyLossCapPct
    ) {
      const reason = `daily loss cap hit: portfolio dropped $${Math.abs(dailyLoss).toFixed(2)} ` +
        `(${(liveConfig.riskDailyLossCapPct * 100).toFixed(0)}% of $${riskEngine.sessionOpenValue.toFixed(2)})`;
      riskEngine.halt(reason);
      broadcastRiskEvent({
        rule:             "DAILY_LOSS_LIMIT",
        message:          `trading auto-halted: ${reason}`,
        portfolioValue:   snap.portfolioValue,
        sessionOpenValue: riskEngine.sessionOpenValue,
      });
      logger.warn("risk_event", { rule: "DAILY_LOSS_LIMIT", message: reason });
    }

    // ── Prices update — send live crypto price data to dashboard ─────────────
    broadcast({ type: "prices_update", data: getAllPriceData() });

    // ── MTM broadcast ─────────────────────────────────────────────────────────
    const freshSnapshot = trader.getSnapshot();
    broadcast({ type: "mtm_update", data: freshSnapshot });

    console.log(
      `[mtm] portfolio=$${freshSnapshot.portfolioValue.toFixed(2)}  ` +
      `cash=$${freshSnapshot.balance.toFixed(2)}  ` +
      `positions=${freshSnapshot.positions.length}  ` +
      `unrealizedPnl=${freshSnapshot.unrealizedPnl >= 0 ? "+" : ""}${freshSnapshot.unrealizedPnl.toFixed(4)}` +
      (riskEngine.isHalted() ? "  [HALTED]" : ""),
    );
  }, MTM_INTERVAL_MS);
}
