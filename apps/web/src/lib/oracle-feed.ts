import {
  ORACLE_FEEDS,
  type OracleFeedSlug,
} from "@ergoscan/shared";

export type { OracleFeedSlug };
import { getGateway } from "./config";

export const ORACLE_PACK = 25;

export type OracleOperator = {
  id: string;
  boxId: string;
  address: string | null;
  height: number | null;
  tsMs: number | null;
  quote: number | null;
  epoch: number | null;
  live: boolean | null;
  addressErgNano: string | null;
  feeNano: string | null;
};

export type OracleTick = {
  t: number | null;
  height: number;
  quote: number;
  market: number | null;
};

export type OracleFeedPack = {
  ready: boolean;
  source: string;
  slug: OracleFeedSlug;
  quote: number | null;
  epoch: number | null;
  height: number | null;
  tipHeight: number | null;
  poolBoxId: string | null;
  live: number;
  liveKnown: boolean;
  issued: number;
  /** Oracle tokens sitting in wallets, not in the pool script. */
  idle: number;
  operators: OracleOperator[];
  total: number;
  ticks: OracleTick[];
  market: {
    circulating: number | null;
    volume24h: number | null;
    ergUsd: number | null;
  } | null;
};

async function gwJson<T>(path: string): Promise<T | null> {
  const gw = getGateway();
  try {
    const r = await fetch(`${gw}${path}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchOracleFeed(
  slug: OracleFeedSlug,
  range: "7d" | "30d" = "30d"
): Promise<OracleFeedPack | null> {
  const j = await gwJson<OracleFeedPack>(`/v1/oracles/${slug}?range=${range}`);
  if (!j || j.slug !== slug) return null;
  return {
    ...emptyOracleFeed(slug),
    ...j,
    ready: j.ready === true,
    source: j.source || "lumen-oracle",
    operators: Array.isArray(j.operators) ? j.operators : [],
    ticks: Array.isArray(j.ticks) ? j.ticks : [],
    total: Array.isArray(j.operators) ? j.operators.length : 0,
  };
}

/** Keep the last good snap. Failed / empty client refetch must not blank SSR. */
export function applyOracleFeed(
  prev: OracleFeedPack,
  incoming: OracleFeedPack | null
): OracleFeedPack {
  if (!incoming) return prev;
  if (!incoming.ready && prev.ready) return prev;
  if (!incoming.operators.length && prev.operators.length && incoming.quote == null) {
    return prev;
  }
  return incoming;
}

export function emptyOracleFeed(slug: OracleFeedSlug): OracleFeedPack {
  const def = ORACLE_FEEDS[slug];
  return {
    ready: false,
    source: "lumen-oracle",
    slug,
    quote: null,
    epoch: null,
    height: null,
    tipHeight: null,
    poolBoxId: null,
    live: 0,
    liveKnown: false,
    issued: def.issued,
    idle: 0,
    operators: [],
    total: 0,
    ticks: [],
    market: def.market ? { circulating: null, volume24h: null, ergUsd: null } : null,
  };
}

export function ticksForChart(
  ticks: OracleTick[],
  range: "7d" | "30d"
): { t: number; txs: number; feesErg: number; feesKnown: boolean }[] {
  const since = Date.now() - (range === "7d" ? 7 : 30) * 86_400_000;
  const out: { t: number; txs: number; feesErg: number; feesKnown: boolean }[] = [];
  for (const row of ticks) {
    const t = row.t;
    if (t == null || !Number.isFinite(t) || t < since) continue;
    if (!Number.isFinite(row.quote)) continue;
    const market = row.market;
    const known = market != null && Number.isFinite(market) && market > 0;
    out.push({
      t,
      txs: row.quote,
      feesErg: known ? market : 0,
      feesKnown: known,
    });
  }
  return out.sort((a, b) => a.t - b.t);
}
