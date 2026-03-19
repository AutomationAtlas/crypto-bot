/**
 * Live config singleton — seeded from env at startup, mutable via POST /api/config.
 * strategy.ts and risk.ts import from here instead of directly from env.ts.
 *
 * Persistence: saveConfig() writes liveConfig to backend/data/liveConfig.json.
 * loadConfig() reads it back on startup (call before anything else initializes).
 */

import fs from "fs";
import path from "path";
import { config } from "./env.js";

const DATA_DIR = path.resolve(__dirname, "../../../data");
const CFG_FILE = path.join(DATA_DIR, "liveConfig.json");

export interface LiveConfig {
  // Price feed
  pricePollIntervalMs: number;
  // Strategy
  strategyEnabled:          boolean;
  strategySizeUsd:          number;
  strategyLookback:         number;       // number of 1h candles for Donchian
  strategyConsecutiveTicks: number;       // candle body confirmations required
  strategyTimeframe:        string;       // candle granularity (1h)
  // Circuit breakers
  riskMaxPositions:                number;
  riskDailyLossCapPct:             number;
  riskConsecutiveLossPause:        number;
  riskConsecutiveLossPauseMinutes: number;
  riskCooldownAfterStopMin:        number;
  riskMaxEntriesPerInstrument:     number;
  // Risk / exits
  riskHardStopPct:    number;
  riskSlPct:          number;
  riskTp1Pct:         number;
  riskTp1Qty:         number;
  riskTp1SlOffset:    number;
  riskTp2Pct:         number;
  riskTp2Qty:         number;
  riskTrailPct:       number;
}

export const liveConfig: LiveConfig = {
  pricePollIntervalMs:             10_000,
  strategyEnabled:                 config.strategyEnabled,
  strategySizeUsd:                 config.strategySizeUsd,
  strategyLookback:                config.strategyLookback,
  strategyConsecutiveTicks:        config.strategyConsecutiveTicks,
  strategyTimeframe:               "1h",
  riskMaxPositions:                3,
  riskDailyLossCapPct:             0.05,   // halt if portfolio drops 5% in a session
  riskConsecutiveLossPause:        3,
  riskConsecutiveLossPauseMinutes: 60,
  riskCooldownAfterStopMin:        30,
  riskMaxEntriesPerInstrument:     2,
  riskHardStopPct:                 config.riskHardStopPct,
  riskSlPct:                       config.riskSlPct,
  riskTp1Pct:                      config.riskTp1Pct,
  riskTp1Qty:                      config.riskTp1Qty,
  riskTp1SlOffset:                 config.riskTp1SlOffset,
  riskTp2Pct:                      config.riskTp2Pct,
  riskTp2Qty:                      config.riskTp2Qty,
  riskTrailPct:                    config.riskTrailPct,
};

// ─── Persistence ──────────────────────────────────────────────────────────────

export function saveConfig(): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CFG_FILE, JSON.stringify(liveConfig, null, 2), "utf-8");
  } catch (err) {
    console.error("[configStore] Failed to save liveConfig:", err);
  }
}

export function loadConfig(): void {
  try {
    if (!fs.existsSync(CFG_FILE)) return;
    const raw = fs.readFileSync(CFG_FILE, "utf-8");
    const saved = JSON.parse(raw) as Partial<LiveConfig>;
    Object.assign(liveConfig, saved);
  } catch (err) {
    console.error("[configStore] Failed to load liveConfig — using defaults:", err);
  }
}
