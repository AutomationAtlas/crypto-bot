import dotenv from "dotenv";

dotenv.config();

export const config = {
  port:         parseInt(process.env.PORT ?? "8082", 10),
  nodeEnv:      process.env.NODE_ENV ?? "development",
  paperTrading: process.env.PAPER_TRADING !== "false", // default true
  paperBalance: parseFloat(process.env.PAPER_BALANCE ?? "10000"), // USD

  // Strategy
  strategyEnabled:          process.env.STRATEGY_ENABLED !== "false",   // default true
  strategySizeUsd:          parseFloat(process.env.STRATEGY_SIZE_USD    ?? "500"),
  strategyLookback:         parseInt(process.env.STRATEGY_LOOKBACK      ?? "30",  10), // candles
  strategyConsecutiveTicks: parseInt(process.env.STRATEGY_CONSECUTIVE_TICKS ?? "1", 10),

  // Tiered exits (crypto-appropriate)
  riskSlPct:       parseFloat(process.env.RISK_SL_PCT        ?? "0.03"),  // 3%
  riskTp1Pct:      parseFloat(process.env.RISK_TP1_PCT       ?? "0.04"),  // 4%
  riskTp1Qty:      parseFloat(process.env.RISK_TP1_QTY       ?? "0.50"),  // sell 50%
  riskTp1SlOffset: parseFloat(process.env.RISK_TP1_SL_OFFSET ?? "0.015"), // move SL to -1.5% after TP1
  riskTp2Pct:      parseFloat(process.env.RISK_TP2_PCT       ?? "0.08"),  // 8%
  riskTp2Qty:      parseFloat(process.env.RISK_TP2_QTY       ?? "0.50"),  // sell 50% of remaining
  riskTrailPct:    parseFloat(process.env.RISK_TRAIL_PCT      ?? "0.02"),  // 2% trailing stop
  riskHardStopPct: parseFloat(process.env.RISK_HARD_STOP_PCT  ?? "0.05"),  // 5% gap stop
} as const;
