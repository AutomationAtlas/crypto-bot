"use client";

import { useEffect, useRef, useState } from "react";
import type { PortfolioSnapshot, TradeRecord } from "@/lib/types";
import { API_BASE } from "@/lib/api";
import { fmtCryptoPrice, fmtUsd } from "@/lib/utils";

interface Props {
  snapshot: PortfolioSnapshot | null;
}

export function TradesTable({ snapshot }: Props) {
  const [trades,     setTrades]     = useState<TradeRecord[]>([]);
  const [newTradeId, setNewTradeId] = useState<number | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTopId  = useRef<number | null>(null);

  async function fetchHistory() {
    try {
      const res  = await fetch(`${API_BASE}/api/trade/history`);
      const json = await res.json() as TradeRecord[];
      const latest = json[json.length - 1];
      if (latest && latest.id !== prevTopId.current) {
        if (flashTimer.current) clearTimeout(flashTimer.current);
        setNewTradeId(latest.id);
        flashTimer.current = setTimeout(() => setNewTradeId(null), 1800);
        prevTopId.current = latest.id;
      }
      setTrades([...json].reverse()); // newest first
    } catch { /* ignore */ }
  }

  useEffect(() => { void fetchHistory(); }, []);
  useEffect(() => { void fetchHistory(); }, [snapshot?.timestamp]);
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  return (
    <div className="term-panel term-panel-accent p-5">
      <div className="term-head">
        <span className="term-section-label">Recent Trades</span>
        <span className="font-term" style={{ fontSize: "0.6rem", color: "var(--text-4)" }}>
          {trades.length} total
        </span>
      </div>

      <div style={{ maxHeight: 240, overflowY: "auto" }}>
        <table className="term-table">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Pair</th>
              <th style={{ textAlign: "left" }}>Side</th>
              <th style={{ textAlign: "right" }}>Price</th>
              <th style={{ textAlign: "right" }}>Total</th>
              <th style={{ textAlign: "right" }}>Type</th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: "var(--text-4)", padding: "0.75rem 0" }}>No trades yet</td>
              </tr>
            )}
            {trades.slice(0, 40).map((t) => (
              <tr key={t.id} className={t.id === newTradeId ? "row-flash" : ""}>
                <td style={{ color: "var(--text-1)" }}>{t.symbol.replace("USDT", "/USDT")}</td>
                <td style={{ color: t.side === "buy" ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                  {t.side.toUpperCase()}
                </td>
                <td style={{ textAlign: "right" }}>{fmtCryptoPrice(t.price, t.symbol)}</td>
                <td style={{ textAlign: "right", color: "var(--text-1)" }}>{fmtUsd(t.total)}</td>
                <td style={{ textAlign: "right", color: "var(--text-3)", fontSize: "0.6rem" }}>
                  {t.exitType ?? "market"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
