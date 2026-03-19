"use client";

import { useEffect, useState } from "react";
import type { StrategyEvent, StrategyStatus } from "@/lib/types";
import { API_BASE } from "@/lib/api";
import { fmtCryptoPrice, timeAgo } from "@/lib/utils";

const INSTRUMENTS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"];

interface Props {
  strategyEvents: StrategyEvent[];
}

export function StrategyPanel({ strategyEvents }: Props) {
  const [status,  setStatus]  = useState<StrategyStatus | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchStatus() {
    try {
      const res  = await fetch(`${API_BASE}/api/strategy/status`);
      const json = await res.json() as StrategyStatus;
      setStatus(json);
    } catch { /* ignore */ }
  }

  useEffect(() => { void fetchStatus(); }, []);
  useEffect(() => { if (strategyEvents.length > 0) void fetchStatus(); }, [strategyEvents.length]);

  async function toggleStrategy() {
    if (!status) return;
    setLoading(true);
    const endpoint = status.enabled ? "/api/strategy/disable" : "/api/strategy/enable";
    try { await fetch(`${API_BASE}${endpoint}`, { method: "POST" }); }
    finally { setLoading(false); void fetchStatus(); }
  }

  return (
    <div className="term-panel term-panel-accent p-5">
      <div className="term-head">
        <span className="term-section-label">
          Donchian Breakout Strategy
          {status && (
            <span className="font-term" style={{ fontSize: "0.6rem", color: "var(--text-4)", marginLeft: "0.75rem", fontWeight: 400 }}>
              {status.config.lookback}× {status.config.timeframe} · ${ status.config.sizeUsd} per trade
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <span className={`badge ${status?.enabled ? "badge-active" : "badge-inactive"}`}>
            {status?.enabled ? "ACTIVE" : "INACTIVE"}
          </span>
          <button
            className={`term-btn-toggle-${status?.enabled ? "on" : "off"}`}
            onClick={toggleStrategy}
            disabled={loading}
          >
            {status?.enabled ? "DISABLE" : "ENABLE"}
          </button>
        </div>
      </div>

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
      >
        {INSTRUMENTS.map((instr) => {
          const state = status?.instruments[instr];
          const isBreakout = state?.signal === "BREAKOUT";
          return (
            <div
              key={instr}
              className="strat-row"
              style={{
                gridTemplateColumns: "1fr auto",
                borderColor: isBreakout ? "rgba(0,184,255,0.4)" : undefined,
              }}
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-term" style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-1)" }}>
                    {instr.replace("USDT", "/USDT")}
                  </span>
                  {isBreakout && (
                    <span className="badge badge-breakout" style={{ padding: "0.1rem 0.4rem", fontSize: "0.55rem" }}>
                      BREAKOUT
                    </span>
                  )}
                </div>
                {state?.donchianHigh != null && (
                  <div className="font-term" style={{ fontSize: "0.6rem", color: "var(--text-3)" }}>
                    H {fmtCryptoPrice(state.donchianHigh, instr)} · L {fmtCryptoPrice(state.donchianLow ?? 0, instr)}
                  </div>
                )}
                {state?.lastAction && (
                  <div className="font-term" style={{ fontSize: "0.6rem", color: "var(--text-4)", marginTop: "0.15rem" }}>
                    {state.lastAction} · {state.lastActionAt ? timeAgo(state.lastActionAt) : ""}
                  </div>
                )}
              </div>
              {state?.lastCandle && (
                <div style={{ textAlign: "right" }}>
                  <div className="font-term" style={{ fontSize: "0.65rem", color: state.lastCandle.close >= state.lastCandle.open ? "var(--green)" : "var(--red)" }}>
                    {fmtCryptoPrice(state.lastCandle.close, instr)}
                  </div>
                  <div className="font-term" style={{ fontSize: "0.55rem", color: "var(--text-4)" }}>
                    {state.lastCandle.close >= state.lastCandle.open ? "▲" : "▼"}
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
