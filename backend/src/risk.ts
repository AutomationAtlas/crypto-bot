import { config } from "./config/env";
import { liveConfig } from "./config/configStore";
import type { PortfolioSnapshot, Position } from "./trader";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskRule =
  | "MAX_POSITION_SIZE"
  | "MAX_OPEN_POSITIONS"
  | "ORDER_SIZE_CAP"
  | "STOP_LOSS"
  | "DAILY_LOSS_LIMIT"
  | "HALTED"
  | "TP1"
  | "TP2"
  | "RUNNER"
  | "GAP_STOP";

export interface RiskViolation {
  rule: RiskRule;
  message: string;
  symbol?: string;
}

export interface PreTradeCheck {
  ok: boolean;
  violations: RiskViolation[];
}

export interface ExitSignal {
  type: "SL" | "TP1" | "TP2" | "RUNNER";
  reason: string;
  qtyPct: number;    // fraction of position to sell (0–1)
  moveSL?: boolean;  // after TP1, move SL to breakeven offset
}

// ─── Limits ───────────────────────────────────────────────────────────────────

const LIMITS = {
  MAX_POSITION_PCT:   0.25,   // 25% of portfolio per position (crypto is more volatile)
  MAX_ORDER_NOTIONAL: 5000,   // max $ per single trade
} as const;

// ─── Tiered exit evaluation ───────────────────────────────────────────────────

export function checkExits(position: Position): ExitSignal[] {
  const signals: ExitSignal[] = [];
  const { currentPrice, entryPrice, peakPrice, tp1Fired, tp2Fired, breakevenPrice, slPct } = position;

  // ── Gap stop: price crashes hard (e.g. flash crash) ────────────────────────
  const dropPct = entryPrice > 0 ? (entryPrice - currentPrice) / entryPrice : 0;
  if (dropPct >= liveConfig.riskHardStopPct) {
    signals.push({
      type:   "SL",
      reason: `gap stop: price dropped ${(dropPct * 100).toFixed(2)}% from entry ${entryPrice.toFixed(2)}`,
      qtyPct: 1,
    });
    return signals;
  }

  // ── Stop-loss ──────────────────────────────────────────────────────────────
  if (!tp1Fired) {
    const sl    = slPct > 0 ? slPct : liveConfig.riskSlPct;
    const slPrice = entryPrice * (1 - sl);
    if (currentPrice <= slPrice) {
      signals.push({
        type:   "SL",
        reason: `SL hit: ${currentPrice.toFixed(2)} ≤ ${slPrice.toFixed(2)} (${(sl * 100).toFixed(2)}% SL)`,
        qtyPct: 1,
      });
      return signals;
    }
  } else if (breakevenPrice !== null && currentPrice <= breakevenPrice) {
    signals.push({
      type:   "SL",
      reason: `SL hit (post-TP1 breakeven): ${currentPrice.toFixed(2)} ≤ ${breakevenPrice.toFixed(2)}`,
      qtyPct: 1,
    });
    return signals;
  }

  // ── TP1 ───────────────────────────────────────────────────────────────────
  if (!tp1Fired) {
    const tp1Price = entryPrice * (1 + liveConfig.riskTp1Pct);
    if (currentPrice >= tp1Price) {
      signals.push({
        type:   "TP1",
        reason: `TP1 hit: ${currentPrice.toFixed(2)} ≥ ${tp1Price.toFixed(2)} (+${(liveConfig.riskTp1Pct * 100).toFixed(2)}%)`,
        qtyPct: liveConfig.riskTp1Qty,
        moveSL: true,
      });
    }
  }

  // ── TP2 ───────────────────────────────────────────────────────────────────
  if (tp1Fired && !tp2Fired) {
    const tp2Price = entryPrice * (1 + liveConfig.riskTp2Pct);
    if (currentPrice >= tp2Price) {
      signals.push({
        type:   "TP2",
        reason: `TP2 hit: ${currentPrice.toFixed(2)} ≥ ${tp2Price.toFixed(2)} (+${(liveConfig.riskTp2Pct * 100).toFixed(2)}%)`,
        qtyPct: liveConfig.riskTp2Qty,
      });
    }
  }

  // ── Trailing stop (RUNNER — active after TP1) ─────────────────────────────
  if (tp1Fired && currentPrice < peakPrice) {
    const trailStop = peakPrice * (1 - liveConfig.riskTrailPct);
    if (currentPrice <= trailStop) {
      signals.push({
        type:   "RUNNER",
        reason: `trail stop: ${currentPrice.toFixed(2)} ≤ ${trailStop.toFixed(2)} (peak ${peakPrice.toFixed(2)})`,
        qtyPct: 1,
      });
    }
  }

  return signals;
}

// ─── Risk engine ──────────────────────────────────────────────────────────────

class RiskEngine {
  private halted = false;
  private haltReason: string | null = null;
  readonly sessionOpenValue: number;

  constructor(sessionOpenValue: number) {
    this.sessionOpenValue = sessionOpenValue;
  }

  isHalted(): boolean          { return this.halted; }
  getHaltReason(): string | null { return this.haltReason; }
  getLimits(): typeof LIMITS   { return LIMITS; }

  halt(reason: string): void {
    this.halted      = true;
    this.haltReason  = reason;
  }

  resume(paperMode: boolean): { ok: boolean; error?: string } {
    if (!paperMode) return { ok: false, error: "resume only allowed in paper trading mode" };
    this.halted     = false;
    this.haltReason = null;
    return { ok: true };
  }

  checkBuy(
    symbol: string,
    qty: number,
    price: number,
    snapshot: PortfolioSnapshot,
  ): PreTradeCheck {
    if (this.halted) {
      return { ok: false, violations: [{ rule: "HALTED", message: `trading halted: ${this.haltReason}` }] };
    }

    const violations: RiskViolation[] = [];
    const notional      = qty * price;
    const portfolioValue = Math.max(snapshot.portfolioValue, 0.0001);

    if (notional > LIMITS.MAX_ORDER_NOTIONAL) {
      violations.push({
        rule:    "ORDER_SIZE_CAP",
        symbol,
        message: `order notional $${notional.toFixed(2)} exceeds cap of $${LIMITS.MAX_ORDER_NOTIONAL}`,
      });
    }

    const isNewSymbol = !snapshot.positions.find((p) => p.symbol === symbol);
    if (isNewSymbol && snapshot.positions.length >= liveConfig.riskMaxPositions) {
      violations.push({
        rule:    "MAX_OPEN_POSITIONS",
        symbol,
        message: `already at max ${liveConfig.riskMaxPositions} open positions`,
      });
    }

    const existing      = snapshot.positions.find((p) => p.symbol === symbol);
    const newPositionMv = (existing?.marketValue ?? 0) + notional;
    if (newPositionMv / portfolioValue > LIMITS.MAX_POSITION_PCT) {
      violations.push({
        rule:    "MAX_POSITION_SIZE",
        symbol,
        message: `position would be ${((newPositionMv / portfolioValue) * 100).toFixed(1)}% of portfolio (max ${LIMITS.MAX_POSITION_PCT * 100}%)`,
      });
    }

    return { ok: violations.length === 0, violations };
  }

  checkSell(): PreTradeCheck {
    if (this.halted) {
      return { ok: false, violations: [{ rule: "HALTED", message: `trading halted: ${this.haltReason}` }] };
    }
    return { ok: true, violations: [] };
  }

  isDailyLossBreached(snapshot: PortfolioSnapshot): boolean {
    const drawdownPct = ((snapshot.portfolioValue - this.sessionOpenValue) / this.sessionOpenValue) * 100;
    return drawdownPct < -liveConfig.riskDailyLossCapPct * 100;
  }
}

export const riskEngine = new RiskEngine(config.paperBalance);
