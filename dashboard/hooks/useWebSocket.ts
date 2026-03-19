"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PortfolioSnapshot, RiskEvent, StrategyEvent, CryptoPriceData } from "@/lib/types";

const WS_URL = (() => {
  if (typeof window === "undefined") return "ws://localhost:8082/ws";
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  if (isLocal) return "ws://localhost:8082/ws";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//api.atlasforgehub.com/ws`;
})();

const RECONNECT_DELAY_MS  = 3000;
const MAX_RISK_EVENTS     = 50;
const MAX_STRATEGY_EVENTS = 50;
const MAX_HISTORY         = 20;

export interface WebSocketState {
  snapshot:         PortfolioSnapshot | null;
  riskEvents:       RiskEvent[];
  strategyEvents:   StrategyEvent[];
  connected:        boolean;
  portfolioHistory: number[];
  priceHistory:     Record<string, number[]>;
  pricesData:       Record<string, CryptoPriceData>;
}

export function useWebSocket(): WebSocketState {
  const [snapshot,         setSnapshot]         = useState<PortfolioSnapshot | null>(null);
  const [riskEvents,       setRiskEvents]       = useState<RiskEvent[]>([]);
  const [strategyEvents,   setStrategyEvents]   = useState<StrategyEvent[]>([]);
  const [connected,        setConnected]        = useState(false);
  const [portfolioHistory, setPortfolioHistory] = useState<number[]>([]);
  const [priceHistory,     setPriceHistory]     = useState<Record<string, number[]>>({});
  const [pricesData,       setPricesData]       = useState<Record<string, CryptoPriceData>>({});

  const wsRef          = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmounted      = useRef(false);

  const connect = useCallback(() => {
    if (unmounted.current) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { type: string; data: unknown };

        if (msg.type === "mtm_update") {
          const snap = msg.data as PortfolioSnapshot;
          setSnapshot(snap);
          setPortfolioHistory((prev) => [...prev, snap.portfolioValue].slice(-MAX_HISTORY));
          setPriceHistory((prev) => {
            const next = { ...prev };
            for (const pos of snap.positions) {
              const hist = prev[pos.symbol] ?? [];
              next[pos.symbol] = [...hist, pos.currentPrice].slice(-MAX_HISTORY);
            }
            return next;
          });
        } else if (msg.type === "prices_update") {
          setPricesData(msg.data as Record<string, CryptoPriceData>);
        } else if (msg.type === "risk_event") {
          setRiskEvents((prev) => [msg.data as RiskEvent, ...prev].slice(0, MAX_RISK_EVENTS));
        } else if (msg.type === "strategy_event") {
          setStrategyEvents((prev) => [msg.data as StrategyEvent, ...prev].slice(0, MAX_STRATEGY_EVENTS));
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (!unmounted.current) {
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
      }
    };

    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    unmounted.current = false;
    connect();
    return () => {
      unmounted.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { snapshot, riskEvents, strategyEvents, connected, portfolioHistory, priceHistory, pricesData };
}
