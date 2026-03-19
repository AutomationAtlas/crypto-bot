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

export interface PortfolioSnapshot {
  balance: number;
  positions: Position[];
  totalMarketValue: number;
  unrealizedPnl: number;
  portfolioValue: number;
  realizedPnl: number;
  timestamp: string;
}

export interface RiskEvent {
  rule: string;
  message: string;
  symbol?: string;
  timestamp: string;
  tradeId?: number;
  portfolioValue?: number;
  sessionOpenValue?: number;
}

export type StrategySignal = "BREAKOUT" | "NONE";
export type StrategyAction = "BOUGHT" | "BLOCKED" | "SKIPPED";

export interface StrategyEvent {
  symbol: string;
  signal: StrategySignal;
  action: StrategyAction;
  detail: string;
  price: number;
  size?: number;
  timestamp: string;
}

export interface InstrumentState {
  signal: StrategySignal;
  donchianHigh: number | null;
  donchianLow:  number | null;
  lastCandle: {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    complete: boolean;
  } | null;
  lastAction:       StrategyAction | null;
  lastActionDetail: string | null;
  lastActionAt:     string | null;
}

export interface StrategyStatus {
  enabled: boolean;
  config: {
    sizeUsd:          number;
    lookback:         number;
    timeframe:        string;
    consecutiveTicks: number;
  };
  instruments: Record<string, InstrumentState>;
}

export interface CryptoPriceData {
  price: number;
  timestamp: string;
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

export interface StatusResponse {
  uptime: number;
  mode: string;
  halted: boolean;
  haltReason: string | null;
  sessionOpenValue: number;
  currentPortfolioValue: number;
  dailyPnl: number;
  dailyPnlPct: number;
  openPositions: number;
  riskRules: {
    MAX_POSITION_PCT: number;
    MAX_ORDER_NOTIONAL: number;
  };
  timestamp: string;
}

export interface LiveConfig {
  pricePollIntervalMs:             number;
  strategyEnabled:                 boolean;
  strategySizeUsd:                 number;
  strategyLookback:                number;
  strategyConsecutiveTicks:        number;
  strategyTimeframe:               string;
  riskMaxPositions:                number;
  riskDailyLossCapPct:             number;
  riskConsecutiveLossPause:        number;
  riskConsecutiveLossPauseMinutes: number;
  riskCooldownAfterStopMin:        number;
  riskMaxEntriesPerInstrument:     number;
  riskHardStopPct:                 number;
  riskSlPct:                       number;
  riskTp1Pct:                      number;
  riskTp1Qty:                      number;
  riskTp1SlOffset:                 number;
  riskTp2Pct:                      number;
  riskTp2Qty:                      number;
  riskTrailPct:                    number;
}
