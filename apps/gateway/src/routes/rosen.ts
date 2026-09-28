/**
 * GET /v1/rosen/events|health  (+ /api/v1/rosen/*)
 * Reads schema `rosen` only. No node. No app.rosen.tech.
 */
import type { Express, Request, Response } from "express";
import pg from "pg";
import {
  chainLabel,
  formatRosenAmount,
  resolveRosenTokenDisplay,
} from "@ergoscan/shared";
import { cacheList, cacheNoStore, cacheTip } from "../lib/httpCache.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool | null {
  const url =
    process.env.DATABASE_READ_URL ||
    process.env.DATABASE_URL ||
    process.env.INDEXER_DATABASE_URL ||
    "";
  if (!url) return null;
  if (!pool) {
    const withTimeout =
      url.includes("options=") || url.includes("statement_timeout")
        ? url
        : `${url}${url.includes("?") ? "&" : "?"}options=${encodeURIComponent("-c statement_timeout=4000")}`;
    pool = new Pool({
      connectionString: withTimeout,
      max: 2,
      connectionTimeoutMillis: 2500,
      idleTimeoutMillis: 20_000,
    });
    pool.on("error", () => {
      /* ignore */
    });
  }
  return pool;
}

async function q<T extends pg.QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T[] | null> {
  const p = getPool();
  if (!p) return null;
  try {
    const r = await p.query<T>(sql, params);
    return r.rows;
  } catch {
    return null;
  }
}

const STATUSES = new Set(["processing", "completed", "fraud"]);

function parseCursor(raw: string | undefined): { ts: number; id: string } | null {
  if (!raw) return null;
  const [ts, ...rest] = raw.split(":");
  const id = rest.join(":");
  const n = Number(ts);
  if (!id || !Number.isFinite(n)) return null;
  return { ts: n, id };
}

function mapEvent(r: Record<string, unknown>) {
  const meta = resolveRosenTokenDisplay(
    String(r.from_chain ?? ""),
    String(r.source_chain_token_id ?? ""),
    r.token_name ? String(r.token_name) : null,
    r.token_decimals as number | string | null
  );
  const dec = meta.decimals ?? 0;
  const amount = String(r.amount ?? "0");
  return {
    id: String(r.event_id),
    eventId: String(r.event_id),
    triggerBoxId: r.trigger_box_id ? String(r.trigger_box_id) : null,
    triggerTxId: r.trigger_tx_id ? String(r.trigger_tx_id) : null,
    height: r.height != null ? Number(r.height) : null,
    time: r.ts_ms != null ? Number(r.ts_ms) : null,
    fromChain: String(r.from_chain ?? ""),
    toChain: String(r.to_chain ?? ""),
    fromChainLabel: chainLabel(String(r.from_chain ?? "")),
    toChainLabel: chainLabel(String(r.to_chain ?? "")),
    fromAddress: String(r.from_address ?? ""),
    toAddress: String(r.to_address ?? ""),
    amount,
    amountDisplay: formatRosenAmount(amount, dec),
    bridgeFee: String(r.bridge_fee ?? "0"),
    networkFee: String(r.network_fee ?? "0"),
    bridgeFeeDisplay: formatRosenAmount(String(r.bridge_fee ?? "0"), dec),
    networkFeeDisplay: formatRosenAmount(String(r.network_fee ?? "0"), dec),
    sourceChainTokenId: String(r.source_chain_token_id ?? ""),
    targetChainTokenId: String(r.target_chain_token_id ?? ""),
    sourceTxId: String(r.source_tx_id ?? ""),
    spendTxId: r.spend_tx_id ? String(r.spend_tx_id) : null,
    paymentTxId: r.payment_tx_id ? String(r.payment_tx_id) : null,
    status: String(r.status ?? "processing"),
    tokenName: meta.name,
    tokenDecimals: meta.decimals,
    ergoSideTokenId: r.ergo_side_token_id
      ? String(r.ergo_side_token_id)
      : meta.ergoSideTokenId,
    widsCount: r.wids_count != null ? Number(r.wids_count) : null,
    watcherChain: r.watcher_chain ? String(r.watcher_chain) : null,
  };
}

export function registerRosenRoutes(app: Express): void {
  const handleEvents = async (req: Request, res: Response) => {
    cacheList(res);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 26));
    const statusRaw = String(req.query.status ?? "").trim();
    const status = STATUSES.has(statusRaw) ? statusRaw : "";
    const cur = parseCursor(typeof req.query.cursor === "string" ? req.query.cursor : undefined);

    const params: unknown[] = [];
    const where: string[] = [];
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    if (cur) {
      params.push(cur.ts, cur.id);
      where.push(
        `(COALESCE(ts_ms, 0), event_id) < ($${params.length - 1}::bigint, $${params.length})`
      );
    }
    params.push(limit + 1);
    const sql = `
      SELECT event_id, trigger_box_id, trigger_tx_id, height, ts_ms,
             from_chain, to_chain, from_address, to_address,
             amount, bridge_fee, network_fee,
             source_chain_token_id, target_chain_token_id,
             source_tx_id, spend_tx_id, payment_tx_id,
             status, token_name, token_decimals, ergo_side_token_id,
             wids_count, watcher_chain
      FROM rosen.events
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY COALESCE(ts_ms, 0) DESC, event_id DESC
      LIMIT $${params.length}
    `;
    const rows = await q<Record<string, unknown>>(sql, params);
    if (rows == null) {
      res.json({
        items: [],
        hasMore: false,
        nextCursor: null,
        source: "lumen-rosen",
        ready: false,
      });
      return;
    }
    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const last = slice[slice.length - 1];
    const nextCursor =
      hasMore && last
        ? `${Number(last.ts_ms) || 0}:${String(last.event_id)}`
        : null;
    res.json({
      items: slice.map(mapEvent),
      hasMore,
      nextCursor,
      source: "lumen-rosen",
      ready: true,
    });
  };

  const handleHealth = async (_req: Request, res: Response) => {
    cacheTip(res);
    const kpis = await q<{
      events_total: number;
      events_24h: number;
      completed_total: number;
      processing_total: number;
      fraud_total: number;
      route_count: number;
      scan_height: number | null;
      tip_height: number | null;
      updated_at_ms: string | number | null;
      source: string;
    }>(`SELECT * FROM rosen.kpis WHERE id = 1`);
    const row = kpis?.[0];
    if (!row) {
      cacheNoStore(res);
      res.json({
        ok: true,
        ready: false,
        source: "lumen-rosen",
        eventsTotal: 0,
        events24h: 0,
        completed: 0,
        processing: 0,
        fraud: 0,
        routes: 0,
        scanHeight: null,
        tipHeight: null,
        updatedAtMs: null,
      });
      return;
    }
    res.json({
      ok: true,
      ready: true,
      source: row.source || "lumen-rosen",
      eventsTotal: Number(row.events_total) || 0,
      events24h: Number(row.events_24h) || 0,
      completed: Number(row.completed_total) || 0,
      processing: Number(row.processing_total) || 0,
      fraud: Number(row.fraud_total) || 0,
      routes: Number(row.route_count) || 0,
      scanHeight: row.scan_height != null ? Number(row.scan_height) : null,
      tipHeight: row.tip_height != null ? Number(row.tip_height) : null,
      updatedAtMs: row.updated_at_ms != null ? Number(row.updated_at_ms) : null,
    });
  };

  for (const base of ["/v1/rosen", "/api/v1/rosen"]) {
    app.get(`${base}/events`, handleEvents);
    app.get(`${base}/health`, handleHealth);
  }
}
