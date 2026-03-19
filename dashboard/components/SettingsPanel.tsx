"use client";

import { useEffect, useState } from "react";
import type { LiveConfig } from "@/lib/types";
import { API_BASE } from "@/lib/api";

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="kv-key" style={{ display: "block", marginBottom: "0.2rem" }}>{label}</label>
      {hint && <div className="font-term" style={{ fontSize: "0.55rem", color: "var(--text-4)", marginBottom: "0.2rem" }}>{hint}</div>}
      <input
        type="number"
        className="term-input"
        value={value}
        step="any"
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
      />
    </div>
  );
}

export function SettingsPanel() {
  const [config, setConfig] = useState<LiveConfig | null>(null);
  const [draft,  setDraft]  = useState<LiveConfig | null>(null);
  const [error,  setError]  = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/config`)
      .then((r) => r.json() as Promise<LiveConfig>)
      .then((c) => { setConfig(c); setDraft(c); })
      .catch(() => setError("Failed to load config"));
  }, []);

  const isDirty = config && draft && JSON.stringify(draft) !== JSON.stringify(config);

  function set(key: keyof LiveConfig, value: number) {
    setDraft((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  async function apply() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const res  = await fetch(`${API_BASE}/api/config`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(draft),
      });
      const json = await res.json() as { ok: boolean; config?: LiveConfig; errors?: string[] };
      if (json.ok && json.config) {
        setConfig(json.config);
        setDraft(json.config);
      } else {
        setError(json.errors?.join("; ") ?? "Unknown error");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setDraft(config);
    setError(null);
  }

  if (!draft) {
    return (
      <div className="term-panel p-5">
        <div className="font-term" style={{ fontSize: "0.7rem", color: "var(--text-4)" }}>
          {error ?? "Loading config…"}
        </div>
      </div>
    );
  }

  return (
    <div className="term-panel term-panel-accent p-5">
      <div className="term-head">
        <span className="term-section-label">Settings</span>
        <div className="flex items-center gap-3">
          {isDirty && (
            <span className="font-term" style={{ fontSize: "0.6rem", color: "var(--yellow)" }}>
              UNSAVED CHANGES
            </span>
          )}
          <button className="term-btn term-btn-ghost" onClick={reset} disabled={saving || !isDirty}>
            RESET
          </button>
          <button className="term-btn term-btn-apply" onClick={apply} disabled={saving || !isDirty}>
            {saving ? "SAVING…" : "APPLY"}
          </button>
        </div>
      </div>

      {error && (
        <div className="font-term mb-4" style={{ fontSize: "0.65rem", color: "var(--red)", background: "rgba(255,53,88,0.06)", border: "1px solid rgba(255,53,88,0.2)", borderRadius: "2px", padding: "0.4rem 0.6rem" }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Strategy */}
        <div className="settings-section">
          <div className="settings-section-label">Strategy</div>
          <div className="space-y-3">
            <Field label="Position Size (USD)" hint="Notional USD per trade" value={draft.strategySizeUsd} onChange={(v) => set("strategySizeUsd", v)} />
            <Field label="Donchian Lookback (candles)" hint="Number of 1h candles for channel calculation" value={draft.strategyLookback} onChange={(v) => set("strategyLookback", v)} />
            <Field label="Candle Confirmations" hint="Consecutive bullish candles required" value={draft.strategyConsecutiveTicks} onChange={(v) => set("strategyConsecutiveTicks", v)} />
          </div>
        </div>

        {/* Circuit Breakers */}
        <div className="settings-section">
          <div className="settings-section-label">Circuit Breakers</div>
          <div className="space-y-3">
            <Field label="Max Open Positions" value={draft.riskMaxPositions} onChange={(v) => set("riskMaxPositions", v)} />
            <Field label="Daily Loss Cap (%)" hint="Halt if portfolio drops by this %" value={draft.riskDailyLossCapPct * 100} onChange={(v) => set("riskDailyLossCapPct", v / 100)} />
            <Field label="Consecutive Loss Pause (#)" hint="Pause strategy after N losses in a row" value={draft.riskConsecutiveLossPause} onChange={(v) => set("riskConsecutiveLossPause", v)} />
            <Field label="Pause Duration (min)" value={draft.riskConsecutiveLossPauseMinutes} onChange={(v) => set("riskConsecutiveLossPauseMinutes", v)} />
            <Field label="Cooldown after SL (min)" value={draft.riskCooldownAfterStopMin} onChange={(v) => set("riskCooldownAfterStopMin", v)} />
            <Field label="Max Entries per Instrument" value={draft.riskMaxEntriesPerInstrument} onChange={(v) => set("riskMaxEntriesPerInstrument", v)} />
          </div>
        </div>

        {/* Risk / Exits */}
        <div className="settings-section">
          <div className="settings-section-label">Risk / Exits</div>
          <div className="space-y-3">
            <Field label="Hard Stop (%)" hint="Gap stop — immediate full close" value={draft.riskHardStopPct * 100} onChange={(v) => set("riskHardStopPct", v / 100)} />
            <Field label="Stop Loss (%)" hint="SL below entry price" value={draft.riskSlPct * 100} onChange={(v) => set("riskSlPct", v / 100)} />
            <Field label="TP1 Target (%)" hint="First take-profit level" value={draft.riskTp1Pct * 100} onChange={(v) => set("riskTp1Pct", v / 100)} />
            <Field label="TP1 Quantity (%)" hint="Fraction to sell at TP1" value={draft.riskTp1Qty * 100} onChange={(v) => set("riskTp1Qty", v / 100)} />
            <Field label="TP1 SL Offset (%)" hint="New SL below entry after TP1" value={draft.riskTp1SlOffset * 100} onChange={(v) => set("riskTp1SlOffset", v / 100)} />
            <Field label="TP2 Target (%)" hint="Second take-profit level" value={draft.riskTp2Pct * 100} onChange={(v) => set("riskTp2Pct", v / 100)} />
            <Field label="TP2 Quantity (%)" hint="Fraction of remaining to sell at TP2" value={draft.riskTp2Qty * 100} onChange={(v) => set("riskTp2Qty", v / 100)} />
            <Field label="Trailing Stop (%)" hint="Trailing stop % below peak price" value={draft.riskTrailPct * 100} onChange={(v) => set("riskTrailPct", v / 100)} />
          </div>
        </div>

      </div>
    </div>
  );
}
