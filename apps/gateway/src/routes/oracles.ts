/**
 * GET /v1/oracles/:slug|health  (+ /api/v1/oracles/*)
 * Reads schema `oracle` only. No node. No byTokenId on this path.
 */
import type { Express, Request, Response } from "express";
import pg from "pg";
import { ORACLE_FEEDS, isOracleFeedSlug, type OracleFeedSlug } from "@ergoscan/shared";
import { cacheList, cacheNoStore } from "../lib/httpCache.js";

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

function isSlug(s: string): s is OracleFeedSlug {
  return isOracleFeedSlug(s);
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function emptyFeed(slug: OracleFeedSlug, ready: boolean) {
  const def = ORACLE_FEEDS[slug];
  return {
    ready,
    source: "lumen-oracle",
    slug,
    pair: def.pair,
    quote: null as number | null,
    epoch: null as number | null,
    height: null as number | null,
    tipHeight: null as number | null,
    poolBoxId: null as string | null,
    live: 0,
    liveKnown: false,
    issued: def.issued,
    operators: [] as unknown[],
    total: 0,
    ticks: [] as unknown[],
    market: def.market
      ? { circulating: null, volume24h: null, ergUsd: null }
      : null,
  };
}

export function registerOracleRoutes(app: Express): void {
  const handleHealth = async (_req: Request, res: Response) => {
    cacheNoStore(res);
    const mode = await q<{ value: string }>(
      `SELECT value FROM oracle.worker_state WHERE key = 'mode'`
    );
    const scan = await q<{ value: string }>(
      `SELECT value FROM oracle.worker_state WHERE key = 'scan_height'`
    );
    const snaps = await q<{
      slug: string;
      box_id: string | null;
      live_operators: number;
    }>(`SELECT slug, box_id, live_operators FROM oracle.pool_snap`);
    if (mode == null && snaps == null) {
      res.json({
        ok: true,
        ready: false,
        source: "lumen-oracle",
        mode: null,
        scanHeight: null,
        feeds: [],
      });
      return;
    }
    res.json({
      ok: true,
      ready: (snaps?.length ?? 0) > 0,
      source: "lumen-oracle",
      mode: mode?.[0]?.value ?? null,
      scanHeight: scan?.[0]?.value != null ? Number(scan[0].value) : null,
      feeds: (snaps ?? []).map((s) => ({
        slug: s.slug,
        poolBoxId: s.box_id,
        live: Number(s.live_operators) || 0,
      })),
    });
  };

  const handleFeed = async (req: Request, res: Response) => {
    cacheList(res);
    const slug = String(req.params.slug || "");
    if (!isSlug(slug)) {
      return res.status(404).json({ error: "unknown_oracle_feed" });
    }
    const range = String(req.query.range ?? "30d") === "7d" ? 7 : 30;
    const since = Date.now() - range * 86_400_000;

    const snap = await q<{
      box_id: string | null;
      creation_height: number | null;
      ts_ms: string | number | null;
      quote: number | null;
      epoch: number | null;
      live_operators: number;
      issued: number;
      market_erg_usd: number | null;
      market_circulating: number | null;
      market_volume_24h: number | null;
    }>(
      `SELECT box_id, creation_height, ts_ms, quote, epoch, live_operators, issued,
              market_erg_usd, market_circulating, market_volume_24h
         FROM oracle.pool_snap WHERE slug = $1`,
      [slug]
    );
    if (snap == null) {
      return res.json(emptyFeed(slug, false));
    }
    const row = snap[0];
    if (!row) {
      return res.json(emptyFeed(slug, false));
    }

    const tip = await q<{ value: string }>(
      `SELECT value FROM oracle.worker_state WHERE key = 'scan_height'`
    );
    const ops = await q<{
      box_id: string;
      address: string | null;
      creation_height: number | null;
      ts_ms: string | number | null;
      quote: number | null;
      epoch: number | null;
      address_erg_nano: string | null;
      fee_nano: string | null;
      live: boolean | null;
    }>(
      `SELECT s.box_id, s.address, s.creation_height, s.ts_ms, s.quote, s.epoch,
              s.address_erg_nano, s.fee_nano, s.live
         FROM oracle.operator_snap s
         JOIN packed.boxes b
           ON b.box_id = packed.hex32(s.box_id) AND b.spent_tx_id IS NULL
         JOIN packed.addr ad
           ON ad.id = b.addr_id AND ad.address NOT LIKE '9%'
        WHERE s.slug = $1
        ORDER BY s.creation_height DESC NULLS LAST, s.box_id`,
      [slug]
    );
    const def = ORACLE_FEEDS[slug];
    const idleRow = await q<{ idle: string }>(
      `SELECT COALESCE(SUM(amount), 0)::text AS idle
         FROM token_balances
        WHERE token_id = $1 AND amount > 0 AND address LIKE '9%'`,
      [def.oracleToken]
    );
    const ticks = await q<{
      ts_ms: string | number | null;
      height: number;
      quote: number;
      market_quote: number | null;
    }>(
      `SELECT ts_ms, height, quote, market_quote
         FROM oracle.ticks
        WHERE slug = $1 AND (ts_ms IS NULL OR ts_ms >= $2)
        ORDER BY height ASC, box_id ASC
        LIMIT 4000`,
      [slug, since]
    );

    const operators = (ops ?? []).map((o) => ({
      id: o.box_id,
      boxId: o.box_id,
      address: o.address,
      height: o.creation_height,
      tsMs: num(o.ts_ms),
      quote: o.quote,
      epoch: o.epoch,
      live: o.live,
      addressErgNano: o.address_erg_nano,
      feeNano: o.fee_nano,
    }));
    const liveKnown = operators.some((o) => o.live != null);
    const idle = Number(idleRow?.[0]?.idle ?? 0);

    res.json({
      ready: true,
      source: "lumen-oracle",
      slug,
      pair: def.pair,
      quote: row.quote,
      epoch: row.epoch,
      height: row.creation_height,
      tipHeight: tip?.[0]?.value != null ? Number(tip[0].value) : null,
      poolBoxId: row.box_id,
      live: liveKnown
        ? operators.filter((o) => o.live === true).length
        : Number(row.live_operators) || 0,
      liveKnown,
      issued: Number(row.issued) || def.issued,
      idle: Number.isFinite(idle) ? idle : 0,
      operators,
      total: operators.length,
      ticks: (ticks ?? []).map((t) => ({
        t: num(t.ts_ms) ?? null,
        height: t.height,
        quote: t.quote,
        market: t.market_quote,
      })),
      market: def.market
        ? {
            circulating: row.market_circulating,
            volume24h: row.market_volume_24h,
            ergUsd: row.market_erg_usd,
          }
        : null,
    });
  };

  for (const base of ["/v1/oracles", "/api/v1/oracles"]) {
    app.get(`${base}/health`, handleHealth);
    app.get(`${base}/:slug`, handleFeed);
  }
}
