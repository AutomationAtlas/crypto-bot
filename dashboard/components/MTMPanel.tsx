"use client";

import { useState, useRef, useEffect } from "react";
import type { PortfolioSnapshot } from "@/lib/types";
import { API_BASE } from "@/lib/api";
import { fmtCryptoPrice, fmtUsd } from "@/lib/utils";

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ data, height = 28 }: { data: number[]; height?: number }) {
  if (data.length < 2) return <div style={{ width: 80, height }} />;
  const min   = Math.min(...data);
  const max   = Math.max(...data);
  const range = max - min || 1;
  const pts   = data
    .map((v, i) => `${(i / (data.length - 1)) * 200},${height - ((v - min) / range) * height}`)
    .join(" ");
  const trend = data[data.length - 1] >= data[0];
  return (
    <div className={trend ? "spark-wrap-up" : "spark-wrap-down"} style={{ width: 80, height }}>
      <svg viewBox={`0 0 200 ${height}`} preserveAspectRatio="none" width="80" height={height}>
        <polyline points={pts} fill="none" stroke={trend ? "var(--green)" : "var(--red)"} strokeWidth="1.5" />
      </svg>
    </div>
  );
}

// ── MTM Panel ─────────────────────────────────────────────────────────────────

interface Props {
  snapshot:         PortfolioSnapshot | null;
  sessionOpenValue: number;
  portfolioHistory: number[];
  priceHistory:     Record<string, number[]>;
}

export function MTMPanel({ snapshot, sessionOpenValue, portfolioHistory, priceHistory }: Props) {
  const [toast,    setToast]    = useState<{ message: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  function showToast(message: string, ok: boolean) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, ok });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  async function handleClose(symbol: string, qty: number) {
    try {
      const res = await fetch(`${API_BASE}/api/trade/sell`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ symbol, qty }),
      });
      const json = await res.json() as { ok: boolean; error?: string };
      showToast(json.ok ? `Closed ${symbol.replace("USDT", "/USDT")}` : (json.error ?? "Error"), json.ok);
    } catch {
      showToast("Network error", false);
    }
  }

  const portfolioValue = snapshot?.portfolioValue ?? sessionOpenValue;
  const dailyPnl       = portfolioValue - sessionOpenValue;
  const dailyPnlPct    = (dailyPnl / sessionOpenValue) * 100;
  const unrealizedPnl  = snapshot?.unrealizedPnl ?? 0;
  const realizedPnl    = snapshot?.realizedPnl   ?? 0;
  const pnlColor       = (v: number) => v >= 0 ? "var(--green)" : "var(--red)";

  return (
    <div className="term-panel term-panel-accent p-5">
      <div className="term-head">
        <span className="term-section-label">Portfolio</span>
        <Sparkline data={portfolioHistory} height={22} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="stat-tile">
          <span className="stat-label">Portfolio Value</span>
          <span className="stat-value glow-accent">{fmtUsd(portfolioValue)}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">Daily P&amp;L</span>
          <span className="stat-value font-term" style={{ color: pnlColor(dailyPnl) }}>
            {dailyPnl >= 0 ? "+" : ""}{fmtUsd(dailyPnl)}
            <span style={{ fontSize: "0.65rem", marginLeft: "0.4rem", opacity: 0.7 }}>
              ({dailyPnlPct >= 0 ? "+" : ""}{dailyPnlPct.toFixed(3)}%)
            </span>
          </span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">Unrealized P&amp;L</span>
          <span className="stat-value font-term" style={{ color: pnlColor(unrealizedPnl), fontSize: "0.8rem" }}>
            {unrealizedPnl >= 0 ? "+" : ""}{fmtUsd(unrealizedPnl)}
          </span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">Realized P&amp;L</span>
          <span className="stat-value font-term" style={{ color: pnlColor(realizedPnl), fontSize: "0.8rem" }}>
            {realizedPnl >= 0 ? "+" : ""}{fmtUsd(realizedPnl)}
          </span>
        </div>
      </div>

      {/* Positions */}
      <div className="term-section-label mb-2">Open Positions ({snapshot?.positions.length ?? 0})</div>
      <div className="space-y-1">
        {!snapshot?.positions.length && (
          <div className="font-term" style={{ fontSize: "0.7rem", color: "var(--text-4)", padding: "0.5rem 0" }}>
            No open positions
          </div>
        )}
        {snapshot?.positions.map((pos) => {
          const hist  = priceHistory[pos.symbol] ?? [];
          const pct   = pos.unrealizedPnlPct;
          const color = pct >= 0 ? "var(--green)" : "var(--red)";
          return (
            <div key={pos.symbol} className="pos-row">
              <div style={{ flex: "0 0 80px" }}>
                <div className="font-term" style={{ fontSize: "0.75rem", color: "var(--text-1)", fontWeight: 600 }}>
                  {pos.symbol.replace("USDT", "/USDT")}
                </div>
                <div className="font-term" style={{ fontSize: "0.6rem", color: "var(--text-3)" }}>
                  {pos.tp1Fired ? (pos.tp2Fired ? "TP2✓" : "TP1✓") : "entry"}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="font-term" style={{ fontSize: "0.7rem", color: "var(--text-1)" }}>
                  {fmtCryptoPrice(pos.currentPrice, pos.symbol)}
                </div>
                <div className="font-term" style={{ fontSize: "0.6rem", color: "var(--text-3)" }}>
                  entry {fmtCryptoPrice(pos.entryPrice, pos.symbol)}
                </div>
              </div>
              <Sparkline data={hist} height={22} />
              <div style={{ flex: "0 0 80px", textAlign: "right" }}>
                <div className="font-term" style={{ fontSize: "0.7rem", color, fontWeight: 600 }}>
                  {pct >= 0 ? "+" : ""}{pct.toFixed(3)}%
                </div>
                <div className="font-term" style={{ fontSize: "0.6rem", color: "var(--text-3)" }}>
                  SL {(pos.slPct * 100).toFixed(2)}%
                </div>
              </div>
              <button
                className="close-btn"
                onClick={() => handleClose(pos.symbol, pos.qty)}
              >
                CLOSE
              </button>
            </div>
          );
        })}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="toast-enter font-term"
          style={{
            position:  "fixed",
            bottom:    "1.5rem",
            right:     "1.5rem",
            padding:   "0.5rem 1rem",
            borderRadius: "2px",
            background: toast.ok ? "rgba(6,232,160,0.12)" : "rgba(255,53,88,0.12)",
            border:     `1px solid ${toast.ok ? "rgba(6,232,160,0.3)" : "rgba(255,53,88,0.3)"}`,
            color:      toast.ok ? "var(--accent)" : "var(--red)",
            fontSize:   "0.7rem",
            zIndex:     50,
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
