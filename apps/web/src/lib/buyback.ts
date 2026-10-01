import { getGateway } from "./config";

export type BuybackKind = "gort" | "dort";
export type BuybackMoveKind = "topup" | "swap" | "return" | "open";

export type BuybackMove = {
  height: number;
  ts: number | null;
  blockId: string | null;
  kind: BuybackMoveKind;
  derg: string;
  dtok: string;
  erg: string;
  token: string;
  tx: string;
  who: string | null;
};

export type BuybackSeriesPoint = {
  t: number;
  erg: number;
  token: number;
};

export type BuybackPack = {
  ready: boolean;
  source: string;
  kind: BuybackKind;
  symbol: string;
  slug: "xau-erg" | "erg-usd";
  tokenId: string;
  nftId: string;
  scriptOracleToken: string;
  box: { id: string; height: number; erg: string; token: string } | null;
  lp: { erg: string; token: string; priceNano: string } | null;
  pool: {
    height: number | null;
    live: number;
    epoch: number | null;
    oracleToken: string | null;
    quote: number | null;
  };
  giveback: "blocked" | "idle" | "used";
  spare: string;
  tipHeight: number | null;
  totals: {
    topups: number;
    swaps: number;
    returns: number;
    opens: number;
    ergIn: string;
    ergOut: string;
    bought: string;
    sent: string;
  };
  lastTopup: { height: number; ts: number | null } | null;
  lastSwap: { height: number; ts: number | null } | null;
  canBuy: string | null;
  epochPay: number | null;
  coverRefreshes: number | null;
  bank: { erg: string; ratioBps: number; payoutOpen: boolean } | null;
  emission: { amount: string; height: number } | null;
  topSigner: { address: string; swaps: number } | null;
  series: BuybackSeriesPoint[];
  moves: BuybackMove[];
};

export const BUYBACK_PACK = 20;

const EMPTY_TOTALS: BuybackPack["totals"] = {
  topups: 0,
  swaps: 0,
  returns: 0,
  opens: 0,
  ergIn: "0",
  ergOut: "0",
  bought: "0",
  sent: "0",
};

export function emptyBuyback(kind: BuybackKind): BuybackPack {
  const gort = kind === "gort";
  return {
    ready: false,
    source: "lumen-index",
    kind,
    symbol: gort ? "GORT" : "DORT",
    slug: gort ? "xau-erg" : "erg-usd",
    tokenId: "",
    nftId: "",
    scriptOracleToken: "",
    box: null,
    lp: null,
    pool: { height: null, live: 0, epoch: null, oracleToken: null, quote: null },
    giveback: "blocked",
    spare: "0",
    tipHeight: null,
    totals: { ...EMPTY_TOTALS },
    lastTopup: null,
    lastSwap: null,
    canBuy: null,
    epochPay: null,
    coverRefreshes: null,
    bank: null,
    emission: null,
    topSigner: null,
    series: [],
    moves: [],
  };
}

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

export async function fetchBuyback(kind: BuybackKind): Promise<BuybackPack | null> {
  const slug = kind === "gort" ? "xau-erg" : "erg-usd";
  const j = await gwJson<BuybackPack>(`/v1/oracles/${slug}/buyback`);
  if (!j || j.kind !== kind) return null;
  return {
    ...emptyBuyback(kind),
    ...j,
    ready: j.ready === true,
    totals: { ...EMPTY_TOTALS, ...j.totals },
    series: Array.isArray(j.series) ? j.series : [],
    moves: Array.isArray(j.moves) ? j.moves : [],
  };
}

/** Keep the last good snap. A failed refetch must not blank the page. */
export function applyBuyback(prev: BuybackPack, incoming: BuybackPack | null): BuybackPack {
  if (!incoming) return prev;
  if (!incoming.ready && prev.ready) return prev;
  return incoming;
}
