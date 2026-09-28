/**
 * One CoinGecko HTTP (ERG + PAXG). Writer lays snapshot_kv.market + ticks.
 * GET paths never call CoinGecko.
 */
import {
  EMPTY_MARKET_SNAP,
  ERG_USD_SOURCE_CG,
  SNAP_MARKET_KEY,
  impliedXauPerErg,
  mergeMarketSnap,
  parseCgMarkets,
  parseMarketSnap,
  type MarketSnapPayload,
} from "@ergoscan/shared";
import type { Queryable } from "./db.js";

const CG_URL =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=ergo,pax-gold";
const UA = "ErgoScan/1.0 (+https://ergoscan.me; Ergo explorer)";
const CG_EVERY_BLOCKS = 2;
const CG_TIMEOUT_MS = 2_500;

let hold: { extras: MarketSnapPayload; height: number } | null = null;
let inflight: Promise<MarketSnapPayload> | null = null;
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

export async function ensureMarketCgSchema(db: Queryable): Promise<void> {
  if (schemaOk) return;
  await db.query(ENSURE_SQL);
  schemaOk = true;
}

async function readPrevMarket(db: Queryable): Promise<MarketSnapPayload | null> {
  const r = await db.query<{ payload: unknown }>(
    `SELECT payload FROM snapshot_kv WHERE key = $1 LIMIT 1`,
    [SNAP_MARKET_KEY]
  );
  return parseMarketSnap(r.rows[0]?.payload);
}

async function fetchCg(): Promise<Partial<MarketSnapPayload> | null> {
  const res = await fetch(CG_URL, {
    signal: AbortSignal.timeout(CG_TIMEOUT_MS),
    headers: { accept: "application/json", "user-agent": UA },
  });
  if (!res.ok) return null;
  const parsed = parseCgMarkets(await res.json());
  if (parsed.ergUsd == null && parsed.xauUsd == null) return null;
  return {
    ...parsed,
    xauPerErg: impliedXauPerErg(parsed.ergUsd, parsed.xauUsd),
    source: ERG_USD_SOURCE_CG,
    ts: Date.now(),
  };
}

export async function upsertMarketSnap(
  db: Queryable,
  tip: number,
  patch: Partial<MarketSnapPayload>
): Promise<MarketSnapPayload> {
  const prev = await readPrevMarket(db);
  const next = mergeMarketSnap(prev, { ...patch, height: tip });
  await db.query(
    `INSERT INTO snapshot_kv (key, payload, height, updated_at)
     VALUES ($1, $2::jsonb, $3, now())
     ON CONFLICT (key) DO UPDATE SET
       payload = EXCLUDED.payload,
       height = EXCLUDED.height,
       updated_at = now()`,
    [SNAP_MARKET_KEY, JSON.stringify(next), tip]
  );
  return next;
}

function cgOnlyPatch(extras: Partial<MarketSnapPayload>): Partial<MarketSnapPayload> {
  return {
    ergUsd: extras.ergUsd,
    xauUsd: extras.xauUsd,
    xauPerErg: extras.xauPerErg,
    rank: extras.rank,
    volume24h: extras.volume24h,
    change24h: extras.change24h,
    source: extras.source,
    ts: extras.ts,
  };
}

export async function persistCgTick(
  db: Queryable,
  height: number,
  extras: MarketSnapPayload
): Promise<void> {
  await ensureMarketCgSchema(db);
  const usd =
    extras.ergUsd != null && Number.isFinite(extras.ergUsd) && extras.ergUsd > 0
      ? extras.ergUsd
      : null;
  await db.query(
    `INSERT INTO market_cg_tick (ts_ms, height, erg_usd, rank, volume24h, change24h, xau_usd)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (ts_ms) DO NOTHING`,
    [
      Date.now(),
      height,
      usd,
      extras.rank,
      extras.volume24h,
      extras.change24h,
      extras.xauUsd,
    ]
  );
}

/** Last good extras. CoinGecko only when tip advanced by 2 blocks. */
export async function resolveAndWriteMarket(
  db: Queryable,
  tip: number
): Promise<MarketSnapPayload> {
  const height = Number.isFinite(tip) ? tip : 0;
  if (hold && height - hold.height < CG_EVERY_BLOCKS) {
    return upsertMarketSnap(db, height, cgOnlyPatch(hold.extras));
  }
  if (inflight) return inflight;
  inflight = (async () => {
    let fresh: Partial<MarketSnapPayload> | null = null;
    try {
      fresh = await fetchCg();
    } catch (e) {
      console.warn(JSON.stringify({ type: "coingecko_skip", err: String(e) }));
    }
    const prev = hold?.extras ?? (await readPrevMarket(db));
    const extras = mergeMarketSnap(prev, fresh ?? {});
    if (fresh?.ergUsd != null || fresh?.xauUsd != null) {
      hold = { extras, height };
      try {
        await persistCgTick(db, height, extras);
      } catch (e) {
        console.warn(JSON.stringify({ type: "market_cg_tick", err: String(e) }));
      }
    }
    return upsertMarketSnap(db, height, cgOnlyPatch(extras));
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function marketOrEmpty(snap: MarketSnapPayload | null): MarketSnapPayload {
  return snap ?? EMPTY_MARKET_SNAP;
}
