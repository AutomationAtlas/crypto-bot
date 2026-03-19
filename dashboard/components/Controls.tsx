"use client";

import { useEffect, useState } from "react";
import type { RiskEvent, StatusResponse } from "@/lib/types";
import { API_BASE } from "@/lib/api";

interface Props {
  riskEvents: RiskEvent[];
}

export function Controls({ riskEvents }: Props) {
  const [status,  setStatus]  = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchStatus() {
    try {
      const res  = await fetch(`${API_BASE}/api/status`);
      const json = await res.json() as StatusResponse;
      setStatus(json);
    } catch { /* ignore */ }
  }

  useEffect(() => { void fetchStatus(); }, []);
  useEffect(() => { if (riskEvents.length > 0) void fetchStatus(); }, [riskEvents.length]);

  async function handleHalt() {
    setLoading(true);
    try { await fetch(`${API_BASE}/api/halt`, { method: "POST" }); }
    finally { setLoading(false); void fetchStatus(); }
  }

  async function handleResume() {
    setLoading(true);
    try { await fetch(`${API_BASE}/api/resume`, { method: "POST" }); }
    finally { setLoading(false); void fetchStatus(); }
  }

  const halted = status?.halted ?? false;

  return (
    <div className="term-panel term-panel-accent p-5">
      <div className="term-head">
        <span className="term-section-label">Controls</span>
        <span className={`badge ${halted ? "badge-halted" : "badge-live"}`}>
          <span
            style={{ width: 5, height: 5, borderRadius: "50%", background: halted ? "var(--red)" : "var(--accent)", display: "inline-block", flexShrink: 0 }}
            className={halted ? "" : "dot-live"}
          />
          {halted ? "HALTED" : "RUNNING"}
        </span>
      </div>

      {/* Bot status KVs */}
      <div className="space-y-0 mb-4">
        {[
          ["Mode",       status?.mode?.toUpperCase() ?? "—"],
          ["Uptime",     status ? `${Math.floor(status.uptime / 3600)}h ${Math.floor((status.uptime % 3600) / 60)}m` : "—"],
          ["Portfolio",  status ? `$${status.currentPortfolioValue.toFixed(2)}` : "—"],
          ["Session P&L", status ? `${status.dailyPnl >= 0 ? "+" : ""}$${status.dailyPnl.toFixed(2)} (${status.dailyPnlPct >= 0 ? "+" : ""}${status.dailyPnlPct.toFixed(3)}%)` : "—"],
          ["Positions",  status ? `${status.openPositions}` : "—"],
        ].map(([k, v]) => (
          <div key={k} className="kv-row">
            <span className="kv-key">{k}</span>
            <span className="kv-val font-term">{v}</span>
          </div>
        ))}
      </div>

      {/* Halt reason */}
      {halted && status?.haltReason && (
        <div
          className="font-term mb-4"
          style={{ fontSize: "0.65rem", color: "var(--red)", background: "rgba(255,53,88,0.06)", border: "1px solid rgba(255,53,88,0.2)", borderRadius: "2px", padding: "0.4rem 0.6rem" }}
        >
          {status.haltReason}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          className="term-btn term-btn-halt"
          onClick={handleHalt}
          disabled={loading || halted}
        >
          HALT
        </button>
        <button
          className="term-btn term-btn-resume"
          onClick={handleResume}
          disabled={loading || !halted}
        >
          RESUME
        </button>
      </div>
    </div>
  );
}
