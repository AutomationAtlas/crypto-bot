/**
 * Donchian channel breakout strategy for crypto.
 *
 * Runs every POLL_INTERVAL_MS (60s).
 * For each instrument, fetches the last N completed 1h candles from Binance.
 * Computes the Donchian channel: highest high and lowest low over those candles.
 *
 * BUY signal:
 *   - Current price > donchianHigh (breakout above the channel)
 *   - Latest completed candle is bullish (close > open — momentum confirmation)
 *   - No existing position for this instrument
 *
 * Exits are handled by the risk engine (SL/TP1/TP2/trailing stop).
 */

import { liveConfig } from "./config/configStore.js";
import { getPrice, fetchCandles, INSTRUMENTS, Candle } from "./priceFeed.js";
import { trader } from "./trader.js";
import { riskEngine } from "./risk.js";
import { logger } from "./logger.js";
import { broadcastStrategyEvent, broadcastConsecutiveLossPause, StrategyEventPayload } from "./ws/broadcaster.js";

const POLL_INTERVAL_MS = 60_000; // check for breakouts every minute

// ─── State ────────────────────────────────────────────────────────────────────

type Signal    = "BREAKOUT" | "NONE";
type ActionKind = "BOUGHT" | "BLOCKED" | "SKIPPED";

interface InstrumentState {
  signal:           Signal;
  donchianHigh:     number | null;
  donchianLow:      number | null;
  lastCandle:       Candle | null;
  lastAction:       ActionKind | null;
  lastActionDetail: string | null;
  lastActionAt:     string | null;
}

const instrumentStates = new Map<string, InstrumentState>();

function getOrCreateState(instrument: string): InstrumentState {
  let state = instrumentStates.get(instrument);
  if (!state) {
    state = {
      signal:           "NONE",
      donchianHigh:     null,
      donchianLow:      null,
      lastCandle:       null,
      lastAction:       null,
      lastActionDetail: null,
      lastActionAt:     null,
    };
    instrumentStates.set(instrument, state);
  }
  return state;
}

let enabled: boolean = liveConfig.strategyEnabled;
let pauseUntil = 0;

// ─── Strategy tick ────────────────────────────────────────────────────────────

async function strategyTick(): Promise<void> {
  // Consecutive loss pause
  if (enabled && trader.getConsecutiveLosses() >= liveConfig.riskConsecutiveLossPause) {
    const pauseMs  = liveConfig.riskConsecutiveLossPauseMinutes * 60_000;
    const pauseMin = liveConfig.riskConsecutiveLossPauseMinutes;
    const n        = trader.getConsecutiveLosses();
    pauseUntil = Date.now() + pauseMs;
    trader.resetConsecutiveLosses();
    disable();
    logger.warn("strategy", { msg: `${n} consecutive losses — pausing ${pauseMin} min` });
    broadcastConsecutiveLossPause(n, pauseMin);
  }
  if (!enabled && pauseUntil > 0 && Date.now() >= pauseUntil) {
    pauseUntil = 0;
    enable();
    logger.info("strategy", { msg: "Consecutive loss pause expired — strategy re-enabled" });
  }

  for (const instrument of INSTRUMENTS) {
    await processInstrument(instrument);
  }
}

async function processInstrument(instrument: string): Promise<void> {
  const state = getOrCreateState(instrument);

  // ── Fetch candles ────────────────────────────────────────────────────────
  const candles = await fetchCandles(instrument, liveConfig.strategyLookback);

  if (candles.length < liveConfig.strategyLookback) {
    state.signal = "NONE";
    return;
  }

  // Donchian high/low over all fetched completed candles
  const donchianHigh = Math.max(...candles.map((c) => c.high));
  const donchianLow  = Math.min(...candles.map((c) => c.low));
  const lastCandle   = candles[candles.length - 1];

  state.donchianHigh = donchianHigh;
  state.donchianLow  = donchianLow;
  state.lastCandle   = lastCandle;

  const currentPrice = getPrice(instrument);
  if (!currentPrice) {
    state.signal = "NONE";
    return;
  }

  // ── Signal detection ─────────────────────────────────────────────────────
  const breakoutAbove = currentPrice > donchianHigh;
  const bullishCandle = lastCandle.close > lastCandle.open; // momentum confirmation

  const prevSignal = state.signal;
  state.signal = (breakoutAbove && bullishCandle) ? "BREAKOUT" : "NONE";

  if (state.signal !== "NONE" && state.signal !== prevSignal) {
    logger.info("strategy_event", {
      instrument,
      signal:       state.signal,
      currentPrice,
      donchianHigh,
      donchianLow,
      enabled,
      msg: `${state.signal} signal for ${instrument} at ${currentPrice.toFixed(2)} (donchian high ${donchianHigh.toFixed(2)})`,
    });
  }

  if (!enabled) return;

  const snapshot   = trader.getSnapshot();
  const hasPosition = snapshot.positions.some((p) => p.symbol === instrument);

  // ── BUY signal ────────────────────────────────────────────────────────────
  if (state.signal === "BREAKOUT" && !hasPosition) {
    // Cooldown after stop-out
    const cooldownMs = liveConfig.riskCooldownAfterStopMin * 60_000;
    if (trader.isInCooldown(instrument, cooldownMs)) {
      const detail = `BLOCKED_COOLDOWN: ${liveConfig.riskCooldownAfterStopMin} min cooldown active after SL`;
      recordAction(state, "BLOCKED", detail);
      emitAndLog(instrument, "BREAKOUT", "BLOCKED", detail, currentPrice);
      return;
    }

    // Max entries per instrument
    if (trader.getEntryCount(instrument) >= liveConfig.riskMaxEntriesPerInstrument) {
      const detail = `BLOCKED_MAX_ENTRIES: already entered ${trader.getEntryCount(instrument)}× (max ${liveConfig.riskMaxEntriesPerInstrument})`;
      recordAction(state, "BLOCKED", detail);
      emitAndLog(instrument, "BREAKOUT", "BLOCKED", detail, currentPrice);
      return;
    }

    // Max concurrent positions
    if (snapshot.positions.length >= liveConfig.riskMaxPositions) {
      const detail = `BLOCKED_MAX_POSITIONS: ${snapshot.positions.length}/${liveConfig.riskMaxPositions} open`;
      recordAction(state, "BLOCKED", detail);
      emitAndLog(instrument, "BREAKOUT", "BLOCKED", detail, currentPrice);
      return;
    }

    const qty      = liveConfig.strategySizeUsd / currentPrice;
    const riskCheck = riskEngine.checkBuy(instrument, qty, currentPrice, snapshot);

    if (!riskCheck.ok) {
      const detail = riskCheck.violations[0].message;
      recordAction(state, "BLOCKED", detail);
      emitAndLog(instrument, "BREAKOUT", "BLOCKED", detail, currentPrice);
      return;
    }

    const result = trader.buy(instrument, qty, currentPrice, { slPct: liveConfig.riskSlPct });

    if (result.ok) {
      const detail = `bought ${qty.toFixed(6)} units at ${currentPrice.toFixed(2)} (SL ${(liveConfig.riskSlPct * 100).toFixed(2)}%)`;
      recordAction(state, "BOUGHT", detail);
      emitAndLog(instrument, "BREAKOUT", "BOUGHT", detail, currentPrice, result.trade.total);
      logger.info("trade", {
        tradeId: result.trade.id, side: "buy", symbol: instrument,
        qty, price: currentPrice, total: result.trade.total, balanceAfter: result.trade.balanceAfter,
        donchianHigh, donchianLow, slPct: liveConfig.riskSlPct,
      });
    } else {
      recordAction(state, "SKIPPED", result.error);
      emitAndLog(instrument, "BREAKOUT", "SKIPPED", result.error, currentPrice);
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function recordAction(state: InstrumentState, action: ActionKind, detail: string): void {
  state.lastAction       = action;
  state.lastActionDetail = detail;
  state.lastActionAt     = new Date().toISOString();
}

function emitAndLog(
  symbol: string,
  signal: string,
  action: ActionKind,
  detail: string,
  price: number,
  size?: number,
): void {
  const payload: StrategyEventPayload = {
    symbol,
    signal: signal as "BREAKOUT" | "NONE",
    action,
    detail,
    price,
    ...(size !== undefined ? { size } : {}),
  };
  broadcastStrategyEvent(payload);
  logger.info("strategy_event", { symbol, signal, action, detail, price });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function enable(): void  { enabled = true; }
export function disable(): void { enabled = false; }
export function isEnabled(): boolean { return enabled; }

export interface StrategyStatus {
  enabled: boolean;
  config: {
    sizeUsd:          number;
    lookback:         number;
    timeframe:        string;
    consecutiveTicks: number;
  };
  instruments: Record<string, {
    signal:           Signal;
    donchianHigh:     number | null;
    donchianLow:      number | null;
    lastCandle:       Candle | null;
    lastAction:       ActionKind | null;
    lastActionDetail: string | null;
    lastActionAt:     string | null;
  }>;
}

export function getStatus(): StrategyStatus {
  const instruments: StrategyStatus["instruments"] = {};
  for (const [sym, state] of instrumentStates) {
    instruments[sym] = { ...state };
  }
  return {
    enabled,
    config: {
      sizeUsd:          liveConfig.strategySizeUsd,
      lookback:         liveConfig.strategyLookback,
      timeframe:        liveConfig.strategyTimeframe,
      consecutiveTicks: liveConfig.strategyConsecutiveTicks,
    },
    instruments,
  };
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initStrategy(): void {
  // Pre-populate state for all instruments
  for (const instrument of INSTRUMENTS) {
    getOrCreateState(instrument);
  }

  strategyTick(); // fire immediately
  setInterval(() => { void strategyTick(); }, POLL_INTERVAL_MS);

  logger.info("strategy_event", {
    msg: `Donchian breakout strategy initialised — enabled=${enabled}, sizeUsd=${liveConfig.strategySizeUsd}, ` +
         `lookback=${liveConfig.strategyLookback} × ${liveConfig.strategyTimeframe} candles`,
  });
}
