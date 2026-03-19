"use client";

import { useWebSocket } from "@/hooks/useWebSocket";
import { MTMPanel }        from "@/components/MTMPanel";
import { TradesTable }     from "@/components/TradesTable";
import { EventFeed }       from "@/components/EventFeed";
import { Controls }        from "@/components/Controls";
import { StrategyPanel }   from "@/components/StrategyPanel";
import { InstrumentsPanel } from "@/components/InstrumentsPanel";
import { SettingsPanel }   from "@/components/SettingsPanel";

// Must match backend config.paperBalance
const SESSION_OPEN_VALUE = 10_000;

export default function Home() {
  const {
    snapshot, riskEvents, strategyEvents, connected,
    portfolioHistory, priceHistory, pricesData,
  } = useWebSocket();

  return (
    <main className="min-h-screen p-5" style={{ background: "var(--bg)" }}>
      <div className="max-w-7xl mx-auto space-y-4">

        {/* ── Header ── */}
        <header
          className="flex items-center justify-between py-3 px-4"
          style={{
            background:     "var(--surface)",
            border:         "1px solid var(--border)",
            borderRadius:   "2px",
            borderTopColor: "var(--accent-dim)",
          }}
        >
          <div className="flex items-center gap-5">
            {/* Logo mark */}
            <div className="flex items-center gap-2.5">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="1" width="7" height="7" stroke="var(--accent)" strokeWidth="1.5" />
                <rect x="10" y="1" width="7" height="7" stroke="var(--cyan)" strokeWidth="1.5" opacity="0.5" />
                <rect x="1" y="10" width="7" height="7" stroke="var(--cyan)" strokeWidth="1.5" opacity="0.5" />
                <rect x="10" y="10" width="7" height="7" stroke="var(--accent)" strokeWidth="1.5" opacity="0.3" />
              </svg>
              <h1
                className="font-term font-bold tracking-widest"
                style={{ fontSize: "0.95rem", color: "var(--text-1)" }}
              >
                CRYPTO<span style={{ color: "var(--accent)" }}>-</span>BOT
              </h1>
            </div>

            <span
              className="font-term"
              style={{
                fontSize:   "0.6rem",
                fontWeight: 600,
                letterSpacing: "0.12em",
                color:      "var(--text-3)",
                border:     "1px solid var(--border-2)",
                padding:    "0.15rem 0.5rem",
                borderRadius: "2px",
                background: "var(--surface-2)",
              }}
            >
              PAPER MODE
            </span>

            <span className="font-term" style={{ fontSize: "0.6rem", color: "var(--text-4)" }}>
              BTC/USDT · ETH/USDT · SOL/USDT · BNB/USDT · XRP/USDT
            </span>
          </div>

          {/* Connection status */}
          <div
            className="flex items-center gap-2 font-term"
            style={{
              fontSize:   "0.65rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              color:      connected ? "var(--accent)" : "var(--yellow)",
            }}
          >
            <span
              className={connected ? "dot-live" : ""}
              style={{
                width:        "6px",
                height:       "6px",
                borderRadius: "50%",
                background:   connected ? "var(--accent)" : "var(--yellow)",
                display:      "inline-block",
                flexShrink:   0,
              }}
            />
            {connected ? "CONNECTED" : "RECONNECTING…"}
          </div>
        </header>

        {/* ── 2-column grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Row 1 */}
          <MTMPanel
            snapshot={snapshot}
            sessionOpenValue={SESSION_OPEN_VALUE}
            portfolioHistory={portfolioHistory}
            priceHistory={priceHistory}
          />
          <Controls riskEvents={riskEvents} />

          {/* Row 2 */}
          <TradesTable snapshot={snapshot} />
          <EventFeed riskEvents={riskEvents} strategyEvents={strategyEvents} />

          {/* Row 3 — full width: live crypto prices */}
          <div className="lg:col-span-2">
            <InstrumentsPanel pricesData={pricesData} />
          </div>

          {/* Row 4 — full width: Donchian strategy state */}
          <div className="lg:col-span-2">
            <StrategyPanel strategyEvents={strategyEvents} />
          </div>

          {/* Row 5 — full width: settings */}
          <div className="lg:col-span-2">
            <SettingsPanel />
          </div>

        </div>
      </div>
    </main>
  );
}
