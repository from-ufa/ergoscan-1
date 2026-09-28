/**
 * Thin overlay reads for GraphQL. Same tables as REST. No boxes scan.
 */
import pg from "pg";
import { ORACLE_FEEDS, isOracleFeedSlug, type OracleFeedSlug } from "@ergoscan/shared";

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
      /* */
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
    return (await p.query<T>(sql, params)).rows;
  } catch {
    return null;
  }
}

function isSlug(s: string): s is OracleFeedSlug {
  return isOracleFeedSlug(s);
}

export async function oracleHealth(): Promise<{
  ready: boolean;
  mode: string | null;
  scanHeight: number | null;
}> {
  const mode = await q<{ value: string }>(
    `SELECT value FROM oracle.worker_state WHERE key = 'mode'`
  );
  const scan = await q<{ value: string }>(
    `SELECT value FROM oracle.worker_state WHERE key = 'scan_height'`
  );
  const snaps = await q<{ slug: string }>(`SELECT slug FROM oracle.pool_snap`);
  return {
    ready: (snaps?.length ?? 0) > 0,
    mode: mode?.[0]?.value ?? null,
    scanHeight: scan?.[0]?.value != null ? Number(scan[0].value) : null,
  };
}

export async function oracleFeed(slugRaw: string): Promise<{
  slug: string;
  ready: boolean;
  pair: string;
  quote: number | null;
  live: number;
  poolBoxId: string | null;
} | null> {
  if (!isSlug(slugRaw)) return null;
  const def = ORACLE_FEEDS[slugRaw];
  const snap = await q<{
    box_id: string | null;
    quote: number | null;
    live_operators: number;
  }>(`SELECT box_id, quote, live_operators FROM oracle.pool_snap WHERE slug = $1`, [slugRaw]);
  if (snap == null) {
    return { slug: slugRaw, ready: false, pair: def.pair, quote: null, live: 0, poolBoxId: null };
  }
  const row = snap[0];
  if (!row) {
    return { slug: slugRaw, ready: false, pair: def.pair, quote: null, live: 0, poolBoxId: null };
  }
  return {
    slug: slugRaw,
    ready: true,
    pair: def.pair,
    quote: row.quote,
    live: Number(row.live_operators) || 0,
    poolBoxId: row.box_id,
  };
}

export async function defiReady(): Promise<{ ready: boolean; source: string }> {
  const rows = await q<{ n: string }>(`SELECT pool_id AS n FROM defi.pool_registry LIMIT 1`);
  if (rows == null) return { ready: false, source: "lumen-defi" };
  return { ready: rows.length > 0, source: "lumen-defi" };
}

export async function rosenReady(): Promise<{
  ready: boolean;
  eventsTotal: number | null;
  scanHeight: number | null;
  source: string;
}> {
  const rows = await q<{
    events_total: number;
    scan_height: number | null;
    source: string;
  }>(`SELECT events_total, scan_height, source FROM rosen.kpis WHERE id = 1`);
  const row = rows?.[0];
  if (!row) return { ready: false, eventsTotal: null, scanHeight: null, source: "lumen-rosen" };
  return {
    ready: true,
    eventsTotal: Number(row.events_total) || 0,
    scanHeight: row.scan_height != null ? Number(row.scan_height) : null,
    source: row.source || "lumen-rosen",
  };
}
