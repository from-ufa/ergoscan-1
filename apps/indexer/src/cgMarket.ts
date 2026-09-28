/**
 * Read CoinGecko extras the oracle writer already laid.
 * Indexer does not call CoinGecko. Gateway GET never calls CoinGecko.
 */
import type pg from "pg";
import {
  ERG_USD_SOURCE_CG,
  SNAP_MARKET_KEY,
  parseMarketSnap,
  type MarketSnapPayload,
} from "@ergoscan/shared";

type Pool = pg.Pool;

export { ERG_USD_SOURCE_CG };

export type CgMarketExtras = {
  ergUsd: number | null;
  rank: number | null;
  volume24h: number | null;
  change24h: number | null;
};

const EMPTY: CgMarketExtras = {
  ergUsd: null,
  rank: null,
  volume24h: null,
  change24h: null,
};

let schemaOk = false;

const ENSURE_SQL = `
CREATE TABLE IF NOT EXISTS market_cg_tick (
  ts_ms      BIGINT PRIMARY KEY,
  height     BIGINT NOT NULL,
  erg_usd    DOUBLE PRECISION,
  rank       INT,
  volume24h  DOUBLE PRECISION,
  change24h  DOUBLE PRECISION
);
CREATE INDEX IF NOT EXISTS market_cg_tick_height_idx ON market_cg_tick (height DESC);
ALTER TABLE market_cg_tick ADD COLUMN IF NOT EXISTS erg_usd DOUBLE PRECISION;
ALTER TABLE market_cg_tick ADD COLUMN IF NOT EXISTS xau_usd DOUBLE PRECISION;
`;

export async function ensureMarketCgSchema(pool: Pool): Promise<void> {
  if (schemaOk) return;
  await pool.query(ENSURE_SQL);
  schemaOk = true;
}

function extrasFrom(snap: MarketSnapPayload | null): CgMarketExtras {
  if (!snap) return EMPTY;
  return {
    ergUsd: snap.ergUsd,
    rank: snap.rank,
    volume24h: snap.volume24h,
    change24h: snap.change24h,
  };
}

function fromHome(raw: unknown): CgMarketExtras | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = parseMarketSnap(raw);
  if (parsed?.ergUsd != null || parsed?.rank != null) return extrasFrom(parsed);
  const p = raw as {
    ergUsd?: unknown;
    rank?: unknown;
    volume24h?: unknown;
    change24h?: unknown;
  };
  const extras: CgMarketExtras = {
    ergUsd: Number(p.ergUsd) > 0 ? Number(p.ergUsd) : null,
    rank: Number(p.rank) >= 1 ? Math.round(Number(p.rank)) : null,
    volume24h: Number(p.volume24h) > 0 ? Number(p.volume24h) : null,
    change24h:
      p.change24h == null || p.change24h === ""
        ? null
        : Number.isFinite(Number(p.change24h))
          ? Number(p.change24h)
          : null,
  };
  return extras.ergUsd != null || extras.rank != null || extras.volume24h != null
    ? extras
    : null;
}

export async function readMarketSnap(pool: Pool): Promise<MarketSnapPayload | null> {
  const r = await pool.query<{ payload: unknown }>(
    `SELECT payload FROM snapshot_kv WHERE key = $1 LIMIT 1`,
    [SNAP_MARKET_KEY]
  );
  return parseMarketSnap(r.rows[0]?.payload);
}

/** Writer snap first, then last home extras. Never HTTP. */
export async function resolveCgMarketExtras(
  pool: Pool,
  _tip: number
): Promise<{ extras: CgMarketExtras; fresh: boolean }> {
  try {
    const snap = await readMarketSnap(pool);
    const fromWriter = extrasFrom(snap);
    if (fromWriter.ergUsd != null) return { extras: fromWriter, fresh: false };
    const home = await pool.query<{ payload: unknown }>(
      `SELECT payload FROM snapshot_kv WHERE key = 'home' LIMIT 1`
    );
    return { extras: fromHome(home.rows[0]?.payload) ?? EMPTY, fresh: false };
  } catch (e) {
    console.warn("[indexer] market snap extras", String(e));
    return { extras: EMPTY, fresh: false };
  }
}

/** Hourly spark from stored CG ticks. Cheap; no boxes join. */
export async function readCgPriceSpark(
  pool: Pool,
  spot: number | null,
  windowMs: number,
  hourMs: number
): Promise<{ t: number; v: number }[]> {
  await ensureMarketCgSchema(pool);
  const since = Date.now() - windowMs;
  const histRes = await pool.query<{ hour: string | number; v: string | number }>(
    `SELECT DISTINCT ON (((ts_ms / $2) * $2))
            ((ts_ms / $2) * $2)::bigint AS hour,
            erg_usd AS v
       FROM market_cg_tick
      WHERE ts_ms >= $1
        AND erg_usd IS NOT NULL
        AND erg_usd > 0
      ORDER BY ((ts_ms / $2) * $2) ASC, ts_ms DESC`,
    [since, hourMs]
  );
  const priceSeries: { t: number; v: number }[] = [];
  for (const row of histRes.rows) {
    const t = typeof row.hour === "number" ? row.hour : Number(row.hour);
    const v = typeof row.v === "number" ? row.v : Number(row.v);
    if (!Number.isFinite(t) || !Number.isFinite(v) || v <= 0) continue;
    priceSeries.push({ t, v });
  }
  if (spot != null && spot > 0) {
    if (priceSeries.length) {
      const last = priceSeries[priceSeries.length - 1]!;
      if (Date.now() - last.t < hourMs) last.v = spot;
      else priceSeries.push({ t: Date.now(), v: spot });
    } else {
      priceSeries.push({ t: Date.now(), v: spot });
    }
  }
  return priceSeries;
}
