/**
 * Site price ticker. One cached read of the Spectrum reserve marks.
 * Dollar price is applied by the caller from the ERG/USD snap.
 */
import { cacheGet, cacheSet } from "./cache.js";
import { getIndexPool } from "./indexDb.js";

export type PriceTapeErg = {
  tokenId: string;
  symbol: string;
  priceErg: number;
  changePct: number | null;
};

type TapeRaw = {
  token_id: string;
  symbol: string | null;
  price_erg: number | null;
  vol24: number | null;
  tvl_erg: number | null;
  prev_erg: number | null;
};

const KEY = "defi:price-tape";
const TTL_MS = 45_000;
const TAPE_N = 18;

const TAPE_SQL = `
WITH pools AS (
  SELECT DISTINCT ON (r.quote_token)
         r.quote_token AS token_id,
         coalesce(nullif(ps.symbol, '?'), nullif(tok.name, '')) AS symbol,
         ps.price_erg::float8 AS price_erg,
         ps.volume_erg_24h::float8 AS vol24,
         ps.tvl_erg::float8 AS tvl_erg
  FROM defi.pool_registry r
  JOIN defi.pool_snap ps ON ps.pool_id = r.pool_id
  LEFT JOIN tokens tok ON tok.token_id = r.quote_token
  WHERE r.venue = 'spectrum_cfmm'
    AND ps.price_erg > 0
    AND ps.price_erg < 100000
  ORDER BY r.quote_token, ps.volume_erg_24h DESC NULLS LAST, ps.tvl_erg DESC NULLS LAST
)
SELECT p.token_id, p.symbol, p.price_erg, p.vol24, p.tvl_erg, prev.price_erg AS prev_erg
FROM pools p
LEFT JOIN LATERAL (
  SELECT t.price_erg
  FROM defi.price_tick t
  WHERE t.token_id = p.token_id
    AND t.ts_ms <= (extract(epoch FROM now()) * 1000)::bigint - 86400000
    AND t.price_erg > 0
  ORDER BY t.ts_ms DESC
  LIMIT 1
) prev ON true
`;

/**
 * Tops: strongest 24h gain, then strongest 24h drop. Flat names stay off.
 * The baseline is the tick about a day ago, not yesterday's closing print.
 */
export function rankPriceTape(rows: TapeRaw[]): PriceTapeErg[] {
  const priced = rows
    .map((row) => {
      const priceErg = Number(row.price_erg);
      const prev = Number(row.prev_erg);
      const vol24 = Number(row.vol24);
      const tvl = Number(row.tvl_erg);
      const symbol = String(row.symbol || "").trim();
      const tokenId = String(row.token_id || "").toLowerCase();
      if (!symbol || !(priceErg > 0) || priceErg >= 100000 || !/^[0-9a-f]{64}$/.test(tokenId)) return null;
      const change = prev > 0 ? ((priceErg - prev) / prev) * 100 : null;
      return {
        tokenId,
        symbol,
        priceErg,
        changePct: change != null && Number.isFinite(change) && Math.abs(change) < 1e6 ? change : null,
        vol24: Number.isFinite(vol24) ? vol24 : 0,
        tvl: Number.isFinite(tvl) ? tvl : 0,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);
  const gainers = priced
    .filter((row) => row.changePct != null && row.changePct > 0)
    .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0) || b.vol24 - a.vol24 || b.tvl - a.tvl);
  const losers = priced
    .filter((row) => row.changePct != null && row.changePct < 0)
    .sort((a, b) => (a.changePct ?? 0) - (b.changePct ?? 0) || b.vol24 - a.vol24 || b.tvl - a.tvl);
  const half = Math.ceil(TAPE_N / 2);
  const upN = Math.min(gainers.length, Math.max(half, TAPE_N - losers.length));
  const downN = Math.min(losers.length, TAPE_N - upN);
  return [...gainers.slice(0, upN), ...losers.slice(0, downN)].map(({ tokenId, symbol, priceErg, changePct }) => ({
    tokenId,
    symbol,
    priceErg,
    changePct,
  }));
}

export async function loadPriceTapeErg(): Promise<PriceTapeErg[]> {
  const hit = cacheGet<PriceTapeErg[]>(KEY);
  if (hit) return hit;
  const pool = getIndexPool();
  if (!pool) return [];
  try {
    const r = await pool.query<TapeRaw>(TAPE_SQL);
    const tape = rankPriceTape(r.rows);
    if (tape.length >= 2) cacheSet(KEY, tape, TTL_MS);
    return tape;
  } catch {
    return [];
  }
}
