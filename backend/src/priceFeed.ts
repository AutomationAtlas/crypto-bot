/**
 * Binance public price feed — no API key required.
 *
 * Polls batch ticker price endpoint every POLL_INTERVAL_MS.
 * Stores current price for each instrument. strategy.ts fetches candles directly
 * from Binance on its own schedule.
 */

import { liveConfig } from "./config/configStore.js";
import { logger } from "./logger.js";

// ─── Instrument list ──────────────────────────────────────────────────────────

export const INSTRUMENTS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
] as const;

export type Instrument = typeof INSTRUMENTS[number];

export interface CryptoPriceData {
  price: number;
  timestamp: string;
}

// ─── In-memory price store ────────────────────────────────────────────────────

const priceCache = new Map<string, CryptoPriceData>();

// ─── Candle fetching (used by strategy.ts) ────────────────────────────────────

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  complete: boolean;
}

/**
 * Fetch the last `count` 1h candles for an instrument from Binance.
 * Binance klines response: [openTime, open, high, low, close, volume, closeTime, ...]
 * We request count+1 to discard the still-forming candle.
 */
export async function fetchCandles(instrument: string, count: number): Promise<Candle[]> {
  const url =
    `https://api.binance.com/api/v3/klines` +
    `?symbol=${instrument}&interval=${liveConfig.strategyTimeframe}&limit=${count + 1}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn("price_feed", { msg: `Binance klines HTTP ${res.status}`, instrument });
      return [];
    }

    const body = (await res.json()) as (string | number)[][];

    // Discard the last (still-forming) candle
    const complete = body.slice(0, -1);

    return complete.map((arr) => ({
      time:     new Date(arr[0] as number).toISOString(),
      open:     parseFloat(arr[1] as string),
      high:     parseFloat(arr[2] as string),
      low:      parseFloat(arr[3] as string),
      close:    parseFloat(arr[4] as string),
      complete: true,
    }));
  } catch (err) {
    logger.error("price_feed", { msg: "Failed to fetch candles", instrument, err: String(err) });
    return [];
  }
}

// ─── Poll cycle ───────────────────────────────────────────────────────────────

async function pollPrices(): Promise<void> {
  const symbolsParam = encodeURIComponent(JSON.stringify([...INSTRUMENTS]));
  const url = `https://api.binance.com/api/v3/ticker/price?symbols=${symbolsParam}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn("price_feed", { msg: `Binance ticker HTTP ${res.status}`, url });
      return;
    }

    const body = (await res.json()) as { symbol: string; price: string }[];
    const now = new Date().toISOString();

    for (const item of body) {
      priceCache.set(item.symbol, {
        price:     parseFloat(item.price),
        timestamp: now,
      });
    }
  } catch (err) {
    logger.error("price_feed", { msg: "Failed to poll Binance prices", err: String(err) });
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getPrice(instrument: string): number | undefined {
  return priceCache.get(instrument)?.price;
}

export function getPriceData(instrument: string): CryptoPriceData | undefined {
  return priceCache.get(instrument);
}

export function getAllPrices(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [sym, data] of priceCache) {
    out[sym] = data.price;
  }
  return out;
}

export function getAllPriceData(): Record<string, CryptoPriceData> {
  const out: Record<string, CryptoPriceData> = {};
  for (const [sym, data] of priceCache) {
    out[sym] = data;
  }
  return out;
}

export function getRegisteredSymbols(): string[] {
  return [...INSTRUMENTS];
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initPriceFeed(): void {
  pollPrices(); // fire immediately
  setInterval(pollPrices, liveConfig.pricePollIntervalMs);
  logger.info("price_feed", {
    msg: `Price feed initialised — polling every ${liveConfig.pricePollIntervalMs}ms`,
    instruments: INSTRUMENTS.join(", "),
  });
}

/** No-op tick kept for broadcaster.ts compatibility */
export function tick(): void {}
