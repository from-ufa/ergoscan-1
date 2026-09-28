"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BallProps, FeeHistogram, MempoolSnapshot, NodeInfoLite, WsServerEvent } from "@ergoscan/shared";
import { getGateway, getWsUrl } from "./config";
import { usePageSync } from "./page-sync";

export function useMempool(initialBalls?: BallProps[], initialP50?: number | null) {
  const { markSynced, bump } = usePageSync();
  const seenBump = useRef(bump);
  const [balls, setBalls] = useState<BallProps[]>(() =>
    Array.isArray(initialBalls) ? initialBalls : []
  );
  const [fees, setFees] = useState<FeeHistogram | null>(() =>
    initialP50 != null && Number.isFinite(initialP50)
      ? {
          ts: 0,
          buckets: [],
          p50: initialP50,
          p90: initialP50,
          recommend: { economy: initialP50, normal: initialP50, turbo: initialP50 },
        }
      : null
  );
  const [node, setNode] = useState<NodeInfoLite | null>(null);
  const [mock, setMock] = useState(true);
  const [connected, setConnected] = useState(false);
  const [selected, setSelected] = useState<BallProps | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const applySnapshot = useCallback((s: MempoolSnapshot) => {
    setBalls(s.balls);
    markSynced();
  }, [markSynced]);

  useEffect(() => {
    let dead = false;
    let retry: ReturnType<typeof setTimeout>;

    const connect = () => {
      if (dead) return;
      try {
        const ws = new WebSocket(getWsUrl());
        wsRef.current = ws;
        ws.onopen = () => {
          setConnected(true);
          ws.send(JSON.stringify({ op: "subscribe", channels: ["mempool", "fees", "blocks"] }));
        };
        ws.onclose = () => {
          setConnected(false);
          retry = setTimeout(connect, 2000);
        };
        ws.onerror = () => ws.close();
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(String(ev.data)) as WsServerEvent;
            if (msg.type === "hello") setMock(msg.data.mock);
            if (msg.type === "mempool.snapshot") applySnapshot(msg.data);
            if (msg.type === "mempool.add") {
              setBalls((prev) => {
                if (prev.some((b) => b.id === msg.data.id)) return prev;
                return [...prev, msg.data];
              });
            }
            if (msg.type === "mempool.remove") {
              setBalls((prev) => prev.filter((b) => b.id !== msg.data.id));
              setSelected((s) => (s?.id === msg.data.id ? null : s));
            }
            if (msg.type === "fees.histogram") setFees(msg.data);
            if (msg.type === "node.info") setNode(msg.data);
          } catch {
            /* ignore */
          }
        };
      } catch {
        retry = setTimeout(connect, 3000);
      }
    };

    const poll = () => {
      if (dead) return;
      void fetch(`${getGateway()}/v1/mempool`)
        .then((r) => r.json())
        .then((s: MempoolSnapshot) => {
          if (!dead && Array.isArray(s?.balls)) applySnapshot(s);
        })
        .catch(() => {});
      void fetch(`${getGateway()}/v1/fees/histogram`)
        .then((r) => r.json())
        .then((f: FeeHistogram) => {
          if (!dead) setFees(f);
        })
        .catch(() => {});
    };
    poll();
    const iv = window.setInterval(poll, 8000);
    void fetch(`${getGateway()}/v1/health`)
      .then((r) => r.json())
      .then((h: { mock?: boolean }) => setMock(Boolean(h.mock)))
      .catch(() => {});

    connect();
    return () => {
      dead = true;
      clearTimeout(retry);
      window.clearInterval(iv);
      wsRef.current?.close();
    };
  }, [applySnapshot]);

  useEffect(() => {
    if (bump === seenBump.current) return;
    seenBump.current = bump;
    if (bump === 0) return;
    void fetch(`${getGateway()}/v1/mempool`)
      .then((r) => r.json())
      .then((s: MempoolSnapshot) => {
        if (Array.isArray(s?.balls)) applySnapshot(s);
      })
      .catch(() => {});
    void fetch(`${getGateway()}/v1/fees/histogram`)
      .then((r) => r.json())
      .then((f: FeeHistogram) => setFees(f))
      .catch(() => {});
  }, [bump, applySnapshot]);

  return { balls, fees, node, mock, connected, selected, setSelected };
}
