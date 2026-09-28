/** CoinGecko extras the oracle writer lays. Pages only read. */

export const ERG_USD_SOURCE_CG = "coingecko";
export const SNAP_MARKET_KEY = "market";

export type MarketSnapPayload = {
  ergUsd: number | null;
  xauUsd: number | null;
  xauPerErg: number | null;
  rank: number | null;
  volume24h: number | null;
  change24h: number | null;
  source: string;
  ts: number | null;
  height: number | null;
  oracleErgUsd: number | null;
  oracleErgUsdNano: number | null;
  oracleErgUsdBoxId: string | null;
  oracleErgUsdHeight: number | null;
};

export const EMPTY_MARKET_SNAP: MarketSnapPayload = {
  ergUsd: null,
  xauUsd: null,
  xauPerErg: null,
  rank: null,
  volume24h: null,
  change24h: null,
  source: ERG_USD_SOURCE_CG,
  ts: null,
  height: null,
  oracleErgUsd: null,
  oracleErgUsdNano: null,
  oracleErgUsdBoxId: null,
  oracleErgUsdHeight: null,
};

export function posNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function posInt(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : null;
}

export function finiteNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Implied oz gold per 1 ERG from two USD spots. */
export function impliedXauPerErg(
  ergUsd: number | null,
  xauUsd: number | null
): number | null {
  if (ergUsd == null || xauUsd == null || ergUsd <= 0 || xauUsd <= 0) return null;
  const q = ergUsd / xauUsd;
  return Number.isFinite(q) && q > 0 ? q : null;
}

export type CgMarketsParse = {
  ergUsd: number | null;
  xauUsd: number | null;
  rank: number | null;
  volume24h: number | null;
  change24h: number | null;
};

function rowId(row: unknown): string {
  if (!row || typeof row !== "object") return "";
  return String((row as { id?: unknown }).id ?? "").toLowerCase();
}

/** `coins/markets?ids=ergo,pax-gold` — pick by id, not array order. */
export function parseCgMarkets(rows: unknown): CgMarketsParse {
  const empty: CgMarketsParse = {
    ergUsd: null,
    xauUsd: null,
    rank: null,
    volume24h: null,
    change24h: null,
  };
  if (!Array.isArray(rows)) return empty;
  let ergo: Record<string, unknown> | null = null;
  let gold: Record<string, unknown> | null = null;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const id = rowId(row);
    if (id === "ergo") ergo = row as Record<string, unknown>;
    if (id === "pax-gold") gold = row as Record<string, unknown>;
  }
  if (!ergo && rows[0] && typeof rows[0] === "object") {
    ergo = rows[0] as Record<string, unknown>;
  }
  return {
    ergUsd: posNum(ergo?.current_price),
    xauUsd: posNum(gold?.current_price),
    rank: posInt(ergo?.market_cap_rank),
    volume24h: posNum(ergo?.total_volume),
    change24h: finiteNum(ergo?.price_change_percentage_24h),
  };
}

function hex64(v: unknown): string | null {
  return typeof v === "string" && /^[0-9a-f]{64}$/i.test(v) ? v.toLowerCase() : null;
}

export function parseMarketSnap(raw: unknown): MarketSnapPayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  const out: MarketSnapPayload = {
    ergUsd: posNum(p.ergUsd),
    xauUsd: posNum(p.xauUsd),
    xauPerErg: posNum(p.xauPerErg),
    rank: posInt(p.rank),
    volume24h: posNum(p.volume24h),
    change24h: finiteNum(p.change24h),
    source: typeof p.source === "string" && p.source.trim() ? p.source.trim() : ERG_USD_SOURCE_CG,
    ts: posInt(p.ts),
    height: posInt(p.height) ?? finiteNum(p.height),
    oracleErgUsd: posNum(p.oracleErgUsd),
    oracleErgUsdNano: posNum(p.oracleErgUsdNano),
    oracleErgUsdBoxId: hex64(p.oracleErgUsdBoxId),
    oracleErgUsdHeight: posInt(p.oracleErgUsdHeight),
  };
  if (
    out.ergUsd == null &&
    out.xauUsd == null &&
    out.oracleErgUsd == null &&
    out.rank == null &&
    out.volume24h == null &&
    out.change24h == null
  ) {
    return null;
  }
  if (out.xauPerErg == null) out.xauPerErg = impliedXauPerErg(out.ergUsd, out.xauUsd);
  return out;
}

export function mergeMarketSnap(
  prev: MarketSnapPayload | null,
  next: Partial<MarketSnapPayload>
): MarketSnapPayload {
  const base = prev ?? EMPTY_MARKET_SNAP;
  const merged: MarketSnapPayload = {
    ergUsd: next.ergUsd !== undefined ? next.ergUsd : base.ergUsd,
    xauUsd: next.xauUsd !== undefined ? next.xauUsd : base.xauUsd,
    xauPerErg: next.xauPerErg !== undefined ? next.xauPerErg : base.xauPerErg,
    rank: next.rank !== undefined ? next.rank : base.rank,
    volume24h: next.volume24h !== undefined ? next.volume24h : base.volume24h,
    change24h: next.change24h !== undefined ? next.change24h : base.change24h,
    source: next.source ?? base.source,
    ts: next.ts !== undefined ? next.ts : base.ts,
    height: next.height !== undefined ? next.height : base.height,
    oracleErgUsd: next.oracleErgUsd !== undefined ? next.oracleErgUsd : base.oracleErgUsd,
    oracleErgUsdNano:
      next.oracleErgUsdNano !== undefined ? next.oracleErgUsdNano : base.oracleErgUsdNano,
    oracleErgUsdBoxId:
      next.oracleErgUsdBoxId !== undefined ? next.oracleErgUsdBoxId : base.oracleErgUsdBoxId,
    oracleErgUsdHeight:
      next.oracleErgUsdHeight !== undefined ? next.oracleErgUsdHeight : base.oracleErgUsdHeight,
  };
  if (merged.xauPerErg == null) {
    merged.xauPerErg = impliedXauPerErg(merged.ergUsd, merged.xauUsd);
  }
  return merged;
}

/** DeFi / pages: env, then writer snap, then last tick. */
export function pickErgUsd(input: {
  env?: number;
  market?: number | null;
  tick?: number | null;
}): number {
  const env = Number(input.env ?? 0);
  if (env >= 0.05 && env <= 50) return env;
  const market = Number(input.market);
  if (Number.isFinite(market) && market > 0) return market;
  const tick = Number(input.tick);
  if (Number.isFinite(tick) && tick > 0) return tick;
  return 0;
}
