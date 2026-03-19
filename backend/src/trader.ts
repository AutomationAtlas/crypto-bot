import { config } from "./config/env";
import { getAllPrices, getPrice } from "./priceFeed";

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface Position {
  symbol: string;
  qty: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  entryPrice: number;
  entryTime: string;
  peakPrice: number;
  lastNewHighTime: string;
  tp1Fired: boolean;
  tp2Fired: boolean;
  breakevenPrice: number | null;
  slPct: number;
}

export interface TradeRecord {
  id: number;
  side: "buy" | "sell";
  symbol: string;
  qty: number;
  price: number;
  total: number;
  balanceAfter: number;
  timestamp: string;
  exitType?: string;
}

export interface PortfolioSnapshot {
  balance: number;
  positions: Position[];
  totalMarketValue: number;
  unrealizedPnl: number;
  portfolioValue: number;
  realizedPnl: number;
  timestamp: string;
}

// ─── Internal state ───────────────────────────────────────────────────────────

interface PositionState {
  qty: number;
  avgCost: number;
  entryPrice: number;
  entryTime: Date;
  peakPrice: number;
  lastNewHighTime: Date;
  tp1Fired: boolean;
  tp2Fired: boolean;
  breakevenPrice: number | null;
  slPct: number;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

class Trader {
  private balance: number;
  private positions: Map<string, PositionState>;
  private history: TradeRecord[];
  private tradeSeq: number;
  private realizedPnl: number;
  private consecutiveLosses: number;
  private entryCountMap: Map<string, number>;
  private stopOutMap: Map<string, number>;

  constructor(initialBalance: number) {
    this.balance          = initialBalance;
    this.positions        = new Map();
    this.history          = [];
    this.tradeSeq         = 0;
    this.realizedPnl      = 0;
    this.consecutiveLosses = 0;
    this.entryCountMap    = new Map();
    this.stopOutMap       = new Map();
  }

  // ── Buy ─────────────────────────────────────────────────────────────────────

  buy(
    symbol: string,
    qty: number,
    price: number,
    opts: { slPct?: number } = {},
  ): { ok: true; trade: TradeRecord } | { ok: false; error: string } {
    if (qty <= 0)   return { ok: false, error: "qty must be positive" };
    if (price <= 0) return { ok: false, error: "price must be positive" };

    const total = qty * price;
    if (total > this.balance) {
      return { ok: false, error: `insufficient balance (need $${total.toFixed(2)}, have $${this.balance.toFixed(2)})` };
    }

    this.balance -= total;
    this.entryCountMap.set(symbol, (this.entryCountMap.get(symbol) ?? 0) + 1);

    const existing = this.positions.get(symbol);
    if (existing) {
      const totalQty  = existing.qty + qty;
      const totalCost = existing.qty * existing.avgCost + total;
      existing.qty     = totalQty;
      existing.avgCost = totalCost / totalQty;
    } else {
      const now = new Date();
      this.positions.set(symbol, {
        qty,
        avgCost:         price,
        entryPrice:      price,
        entryTime:       now,
        peakPrice:       price,
        lastNewHighTime: now,
        tp1Fired:        false,
        tp2Fired:        false,
        breakevenPrice:  null,
        slPct:           opts.slPct ?? 0,
      });
    }

    const trade: TradeRecord = {
      id:           ++this.tradeSeq,
      side:         "buy",
      symbol,
      qty,
      price,
      total,
      balanceAfter: this.balance,
      timestamp:    new Date().toISOString(),
    };
    this.history.push(trade);
    return { ok: true, trade };
  }

  // ── Sell ────────────────────────────────────────────────────────────────────

  sell(
    symbol: string,
    qty: number,
    price: number,
    exitType?: string,
  ): { ok: true; trade: TradeRecord } | { ok: false; error: string } {
    if (qty <= 0)   return { ok: false, error: "qty must be positive" };
    if (price <= 0) return { ok: false, error: "price must be positive" };

    const position = this.positions.get(symbol);
    if (!position || position.qty < qty - 1e-9) {
      return { ok: false, error: `insufficient position (need ${qty}, hold ${position?.qty ?? 0})` };
    }

    const total      = qty * price;
    const costBasis  = qty * position.avgCost;
    const tradePnl   = total - costBasis;
    this.realizedPnl += tradePnl;
    this.balance     += total;

    const isFullClose = position.qty - qty < 1e-9;
    if (isFullClose) {
      if (tradePnl < 0) { this.consecutiveLosses++; } else { this.consecutiveLosses = 0; }
    }

    position.qty -= qty;
    if (position.qty < 1e-9) this.positions.delete(symbol);

    const trade: TradeRecord = {
      id:           ++this.tradeSeq,
      side:         "sell",
      symbol,
      qty,
      price,
      total,
      balanceAfter: this.balance,
      timestamp:    new Date().toISOString(),
      ...(exitType ? { exitType } : {}),
    };
    this.history.push(trade);
    return { ok: true, trade };
  }

  // ── Partial sell ─────────────────────────────────────────────────────────────

  partialSell(
    symbol: string,
    qtyPct: number,
    price: number,
    exitType: string,
    moveSL = false,
    tp1SlOffset = config.riskTp1SlOffset,
  ): { ok: true; trade: TradeRecord } | { ok: false; error: string } {
    const state = this.positions.get(symbol);
    if (!state) return { ok: false, error: `no position for ${symbol}` };

    const sellQty = state.qty * qtyPct;
    const result  = this.sell(symbol, sellQty, price, exitType);
    if (!result.ok) return result;

    const remaining = this.positions.get(symbol);
    if (remaining) {
      if (exitType === "TP1") {
        remaining.tp1Fired = true;
        if (moveSL) remaining.breakevenPrice = remaining.entryPrice * (1 - tp1SlOffset);
      } else if (exitType === "TP2") {
        remaining.tp2Fired = true;
      }
    }

    return result;
  }

  // ── Tick positions ────────────────────────────────────────────────────────────

  tickPositions(prices: Record<string, number>): void {
    const now = new Date();
    for (const [symbol, state] of this.positions) {
      const price = prices[symbol];
      if (!price) continue;
      if (price > state.peakPrice) {
        state.peakPrice       = price;
        state.lastNewHighTime = now;
      }
    }
  }

  // ── Consecutive loss tracking ─────────────────────────────────────────────────

  getConsecutiveLosses(): number { return this.consecutiveLosses; }
  resetConsecutiveLosses(): void { this.consecutiveLosses = 0; }

  // ── Entry count / cooldown ────────────────────────────────────────────────────

  getEntryCount(symbol: string): number { return this.entryCountMap.get(symbol) ?? 0; }
  recordStopOut(symbol: string): void   { this.stopOutMap.set(symbol, Date.now()); }
  isInCooldown(symbol: string, cooldownMs: number): boolean {
    const t = this.stopOutMap.get(symbol);
    return t !== undefined && Date.now() - t < cooldownMs;
  }

  // ── Snapshot ─────────────────────────────────────────────────────────────────

  getSnapshot(): PortfolioSnapshot {
    const prices = getAllPrices();
    let totalMarketValue = 0;
    let unrealizedPnl    = 0;
    const positions: Position[] = [];

    for (const [symbol, state] of this.positions) {
      const currentPrice  = prices[symbol] ?? state.avgCost;
      const marketValue   = state.qty * currentPrice;
      const pnl           = marketValue - state.qty * state.avgCost;
      const pnlPct        = ((currentPrice - state.avgCost) / state.avgCost) * 100;

      totalMarketValue += marketValue;
      unrealizedPnl    += pnl;

      positions.push({
        symbol,
        qty:               state.qty,
        avgCost:           state.avgCost,
        currentPrice,
        marketValue,
        unrealizedPnl:     pnl,
        unrealizedPnlPct:  pnlPct,
        entryPrice:        state.entryPrice,
        entryTime:         state.entryTime.toISOString(),
        peakPrice:         state.peakPrice,
        lastNewHighTime:   state.lastNewHighTime.toISOString(),
        tp1Fired:          state.tp1Fired,
        tp2Fired:          state.tp2Fired,
        breakevenPrice:    state.breakevenPrice,
        slPct:             state.slPct,
      });
    }

    return {
      balance: this.balance,
      positions,
      totalMarketValue,
      unrealizedPnl,
      portfolioValue: this.balance + totalMarketValue,
      realizedPnl:    this.realizedPnl,
      timestamp:      new Date().toISOString(),
    };
  }

  getHistory(): TradeRecord[] {
    return [...this.history];
  }
}

export const trader = new Trader(config.paperBalance);

/**
 * Close the full position for `symbol` at current market price, if one exists.
 */
export function closePositionIfOpen(
  symbol: string,
): { ok: true; trade: TradeRecord } | { ok: false; reason: string } {
  const price = getPrice(symbol);
  if (!price) return { ok: false, reason: "no price available" };

  const snapshot = trader.getSnapshot();
  const pos = snapshot.positions.find((p) => p.symbol === symbol);
  if (!pos) return { ok: false, reason: "no open position" };

  const result = trader.sell(symbol, pos.qty, price, "MANUAL_CLOSE");
  if (result.ok) return { ok: true, trade: result.trade };
  return { ok: false, reason: result.error };
}
