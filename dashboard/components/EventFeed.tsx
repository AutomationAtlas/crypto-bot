"use client";

import { useMemo } from "react";
import type { RiskEvent, StrategyEvent } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

type FeedItem =
  | ({ kind: "risk" }     & RiskEvent)
  | ({ kind: "strategy" } & StrategyEvent);

interface Props {
  riskEvents:     RiskEvent[];
  strategyEvents: StrategyEvent[];
}

export function EventFeed({ riskEvents, strategyEvents }: Props) {
  const items = useMemo<FeedItem[]>(() => {
    const risk: FeedItem[]     = riskEvents.map((e) => ({ kind: "risk", ...e }));
    const strat: FeedItem[]    = strategyEvents.map((e) => ({ kind: "strategy", ...e }));
    return [...risk, ...strat]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 50);
  }, [riskEvents, strategyEvents]);

  function itemClass(item: FeedItem): string {
    if (item.kind === "risk") {
      const warn = ["STOP_LOSS", "DAILY_LOSS_LIMIT", "HALTED", "GAP_STOP"].includes(item.rule);
      return warn ? "event-item event-item-warn" : "event-item event-item-ok";
    }
    // strategy event
    return item.action === "BOUGHT" ? "event-item event-item-ok" : "event-item event-item-breakout";
  }

  function chipClass(item: FeedItem): string {
    if (item.kind === "risk") {
      const warn = ["STOP_LOSS", "DAILY_LOSS_LIMIT", "HALTED", "GAP_STOP"].includes(item.rule);
      return warn ? "rule-chip rule-chip-warn" : "rule-chip rule-chip-ok";
    }
    return item.action === "BOUGHT" ? "rule-chip rule-chip-ok" : "rule-chip rule-chip-cyan";
  }

  function chipLabel(item: FeedItem): string {
    if (item.kind === "risk")     return item.rule;
    return `${item.action}`;
  }

  function messageText(item: FeedItem): string {
    if (item.kind === "risk")     return item.message;
    return `${item.symbol} — ${item.detail}`;
  }

  return (
    <div className="term-panel term-panel-accent p-5">
      <div className="term-head">
        <span className="term-section-label">Event Feed</span>
        <span className="font-term" style={{ fontSize: "0.6rem", color: "var(--text-4)" }}>
          {items.length} events
        </span>
      </div>

      <div className="space-y-1" style={{ maxHeight: 280, overflowY: "auto" }}>
        {items.length === 0 && (
          <div className="font-term" style={{ fontSize: "0.7rem", color: "var(--text-4)", padding: "0.5rem 0" }}>
            No events yet
          </div>
        )}
        {items.map((item, i) => (
          <div key={i} className={itemClass(item)}>
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className={chipClass(item)}>{chipLabel(item)}</span>
              <span className="font-term" style={{ fontSize: "0.6rem", color: "var(--text-3)" }}>
                {timeAgo(item.timestamp)}
              </span>
            </div>
            <div className="font-term" style={{ fontSize: "0.65rem", color: "var(--text-2)" }}>
              {messageText(item)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
