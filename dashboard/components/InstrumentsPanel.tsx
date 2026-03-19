"use client";

import type { CryptoPriceData } from "@/lib/types";
import { fmtCryptoPrice } from "@/lib/utils";

const INSTRUMENTS = [
  { symbol: "BTCUSDT", name: "Bitcoin / USDT" },
  { symbol: "ETHUSDT", name: "Ethereum / USDT" },
  { symbol: "SOLUSDT", name: "Solana / USDT" },
  { symbol: "BNBUSDT", name: "BNB / USDT" },
  { symbol: "XRPUSDT", name: "XRP / USDT" },
];

interface Props {
  pricesData: Record<string, CryptoPriceData>;
}

export function InstrumentsPanel({ pricesData }: Props) {
  return (
    <div className="term-panel term-panel-accent p-5">
      <div className="term-head">
        <span className="term-section-label">Live Prices</span>
        <span className="font-term" style={{ fontSize: "0.6rem", color: "var(--text-4)" }}>
          BINANCE PUBLIC · 1H BREAKOUT
        </span>
      </div>

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
      >
        {INSTRUMENTS.map(({ symbol, name }) => {
          const data = pricesData[symbol];

          return (
            <div key={symbol} className="instr-row" style={{ gridTemplateColumns: "1fr auto" }}>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-term" style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-1)" }}>
                    {symbol.replace("USDT", "/USDT")}
                  </span>
                </div>
                <div className="font-ui" style={{ fontSize: "0.6rem", color: "var(--text-4)", marginBottom: "0.25rem" }}>
                  {name}
                </div>
                {data ? (
                  <div className="font-term" style={{ fontSize: "0.6rem", color: "var(--text-3)" }}>
                    Updated {new Date(data.timestamp).toLocaleTimeString()}
                  </div>
                ) : (
                  <div className="font-term" style={{ fontSize: "0.65rem", color: "var(--text-4)" }}>
                    Waiting for prices…
                  </div>
                )}
              </div>

              {data && (
                <div style={{ textAlign: "right" }}>
                  <div className="font-term" style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-1)" }}>
                    {fmtCryptoPrice(data.price, symbol)}
                  </div>
                  <div className="font-term" style={{ fontSize: "0.55rem", color: "var(--text-3)" }}>
                    USDT
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
