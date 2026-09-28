/**
 * Market helpers. Spot ERG/USD = CoinGecko via snapshot_kv.market (oracle writer).
 * Rank / 24h volume / 24h % from the same snap. Home is a copy fallback.
 * GET does not call CoinGecko or scan oracle boxes.
 */
import { cacheGetOrSet } from "./cache.js";
import { KNOWN_TOKENS, parseMarketSnap, pickErgUsd } from "@ergoscan/shared";
import {
  getAddressesPage,
  nanoToErgApprox,
  readSnapshot,
  SNAP_HOME,
  SNAP_MARKET,
  withAddressListMarket,
} from "./snapshots.js";

const UA = "ErgoScan/1.0 (+https://ergoscan.me; Ergo explorer)";
const ERG_ZERO = "0".repeat(64);

async function httpJson<T>(url: string, timeoutMs = 12000): Promise<T> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: "application/json", "user-agent": UA },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`http ${res.status} ${url} ${t.slice(0, 100)}`);
  }
  return (await res.json()) as T;
}

// ─── Spectrum markets ───────────────────────────────────────────────────────

export interface SpectrumMarket {
  id: string;
  baseId: string;
  baseSymbol: string;
  quoteId: string;
  quoteSymbol: string;
  lastPrice: number;
  baseVolume?: { value?: number };
  quoteVolume?: { value?: number };
}

export async function fetchSpectrumMarkets(): Promise<SpectrumMarket[]> {
  return cacheGetOrSet("spectrum:markets", 60_000, async () => {
    const data = await httpJson<SpectrumMarket[]>(
      "https://api.spectrum.fi/v1/price-tracking/markets",
      15000
    );
    return Array.isArray(data) ? data : [];
  });
}

export type ErgMarket = {
  usd: number;
  source: string;
  rank: number | null;
  volume24h: number | null;
  change24h: number | null;
};

function posInt(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : null;
}

function posNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function ergUsdSpot(): Promise<{ usd: number; source: string }> {
  const env = Number(process.env.ERG_USD || 0);
  if (env >= 0.05 && env <= 50) return { usd: env, source: "env" };
  return { usd: 0, source: "unavailable" };
}

/** Cached ERG/USD from writer market snap, then home copy. No oracle box scan. */
export async function fetchErgMarket(): Promise<ErgMarket> {
  return cacheGetOrSet("erg:market", 30_000, async () => {
    const [marketSnap, homeSnap] = await Promise.all([
      readSnapshot<Record<string, unknown>>(SNAP_MARKET),
      readSnapshot<{
        ergUsd?: number | null;
        ergUsdSource?: string | null;
        rank?: number | null;
        volume24h?: number | null;
        change24h?: number | null;
      }>(SNAP_HOME),
    ]);
    const market = parseMarketSnap(marketSnap?.payload);
    const p = homeSnap?.payload;
    const usd = pickErgUsd({
      market: market?.ergUsd ?? posNum(p?.ergUsd),
    });
    let source =
      market?.source ||
      (typeof p?.ergUsdSource === "string" && p.ergUsdSource.trim()
        ? p.ergUsdSource.trim()
        : "coingecko");
    if (!(usd > 0)) {
      const spot = await ergUsdSpot();
      source = spot.source;
      return {
        usd: spot.usd,
        source,
        rank: market?.rank ?? posInt(p?.rank),
        volume24h: market?.volume24h ?? posNum(p?.volume24h),
        change24h: market?.change24h ?? finiteChange(p?.change24h),
      };
    }
    return {
      usd,
      source,
      rank: market?.rank ?? posInt(p?.rank),
      volume24h: market?.volume24h ?? posNum(p?.volume24h),
      change24h: market?.change24h ?? finiteChange(p?.change24h),
    };
  });
}

function finiteChange(rawCh: unknown): number | null {
  if (rawCh == null) return null;
  return Number.isFinite(Number(rawCh)) ? Number(rawCh) : null;
}

export async function fetchErgUsd(): Promise<{ usd: number; source: string }> {
  const m = await fetchErgMarket();
  return { usd: m.usd, source: m.source };
}

/** Official Erg-USD from writer market snap, then home copy. No box scan. */
export async function fetchOracleErgUsd(): Promise<{
  usd: number | null;
  nano: number | null;
  boxId: string | null;
  height: number | null;
}> {
  const [marketSnap, homeSnap] = await Promise.all([
    readSnapshot<Record<string, unknown>>(SNAP_MARKET),
    readSnapshot<{
      ergUsdOracle?: number | null;
      ergUsdOracleNano?: number | null;
      ergUsdOracleBoxId?: string | null;
      ergUsdOracleHeight?: number | null;
    }>(SNAP_HOME),
  ]);
  const market = parseMarketSnap(marketSnap?.payload);
  const p = homeSnap?.payload;
  const boxId =
    market?.oracleErgUsdBoxId ||
    (typeof p?.ergUsdOracleBoxId === "string" && /^[0-9a-f]{64}$/i.test(p.ergUsdOracleBoxId)
      ? p.ergUsdOracleBoxId.toLowerCase()
      : null);
  return {
    usd: market?.oracleErgUsd ?? posNum(p?.ergUsdOracle),
    nano: market?.oracleErgUsdNano ?? posNum(p?.ergUsdOracleNano),
    boxId,
    height: market?.oracleErgUsdHeight ?? posInt(p?.ergUsdOracleHeight),
  };
}

export interface TokenPriceQuote {
  tokenId: string;
  symbol: string | null;
  priceErg: number | null;
  priceUsd: number | null;
  ergUsd: number;
  ergUsdSource: string;
  market: {
    pair: string;
    lastPrice: number;
    baseSymbol: string;
    quoteSymbol: string;
    volume: number;
  } | null;
  source: string;
}

function vol(m: SpectrumMarket): number {
  return Number(m.baseVolume?.value ?? m.quoteVolume?.value ?? 0);
}

/**
 * Best-effort USD/ERG price for a token from Spectrum pools.
 * lastPrice = quote units per 1 base unit.
 */
export async function priceForToken(
  tokenId: string,
  preferredSymbol?: string | null
): Promise<TokenPriceQuote> {
  const { usd: ergUsd, source: ergUsdSource } = await fetchErgUsd();
  const empty: TokenPriceQuote = {
    tokenId,
    symbol: preferredSymbol ?? null,
    priceErg: null,
    priceUsd: null,
    ergUsd,
    ergUsdSource,
    market: null,
    source: "none",
  };

  if (tokenId === ERG_ZERO || tokenId === "ERG") {
    return {
      ...empty,
      symbol: "ERG",
      priceErg: 1,
      priceUsd: ergUsd || null,
      source: ergUsdSource,
    };
  }

  let markets: SpectrumMarket[] = [];
  try {
    markets = await fetchSpectrumMarkets();
  } catch {
    return empty;
  }

  const related = markets.filter((m) => m.baseId === tokenId || m.quoteId === tokenId);
  if (!related.length) return empty;

  // Prefer pairs vs SigUSD, then vs ERG, then highest volume
  const score = (m: SpectrumMarket): number => {
    let s = Math.log10(vol(m) + 1);
    const other = m.baseId === tokenId ? m.quoteSymbol : m.baseSymbol;
    if (/sigusd/i.test(other)) s += 1000;
    if (other === "ERG" || m.baseId === ERG_ZERO || m.quoteId === ERG_ZERO) s += 500;
    return s;
  };

  const best = [...related].sort((a, b) => score(b) - score(a))[0];
  const symbol =
    preferredSymbol ||
    (best.baseId === tokenId ? best.baseSymbol : best.quoteSymbol);

  let priceUsd: number | null = null;
  let priceErg: number | null = null;

  // Case A: token is base, quote is SigUSD ≈ USD
  if (best.baseId === tokenId && /sigusd/i.test(best.quoteSymbol) && best.lastPrice > 0) {
    priceUsd = best.lastPrice;
    priceErg = ergUsd > 0 ? best.lastPrice / ergUsd : null;
  }
  // Case B: token is quote, base is ERG → lastPrice = SigUSD? wait: ERG/token price means 1 ERG = lastPrice tokens
  else if (best.quoteId === tokenId && best.baseId === ERG_ZERO && best.lastPrice > 0) {
    // 1 ERG = lastPrice tokens → 1 token = 1/lastPrice ERG
    priceErg = 1 / best.lastPrice;
    priceUsd = ergUsd > 0 ? priceErg * ergUsd : null;
  }
  // Case C: token is base, quote is ERG → lastPrice = ERG per token
  else if (best.baseId === tokenId && best.quoteId === ERG_ZERO && best.lastPrice > 0) {
    priceErg = best.lastPrice;
    priceUsd = ergUsd > 0 ? priceErg * ergUsd : null;
  }
  // Case D: token is quote, base is SigUSD
  else if (best.quoteId === tokenId && /sigusd/i.test(best.baseSymbol) && best.lastPrice > 0) {
    // 1 SigUSD = lastPrice tokens → 1 token = 1/lastPrice USD
    priceUsd = 1 / best.lastPrice;
    priceErg = ergUsd > 0 ? priceUsd / ergUsd : null;
  }
  // Case E: token base vs other — leave erg if quote is ERG already handled
  else if (best.baseId === tokenId && best.lastPrice > 0) {
    // Unknown quote — only set raw
    if (/sigusd/i.test(best.quoteSymbol)) {
      priceUsd = best.lastPrice;
      priceErg = ergUsd > 0 ? priceUsd / ergUsd : null;
    }
  }

  return {
    tokenId,
    symbol,
    priceErg,
    priceUsd,
    ergUsd,
    ergUsdSource,
    market: {
      pair: `${best.baseSymbol}/${best.quoteSymbol}`,
      lastPrice: best.lastPrice,
      baseSymbol: best.baseSymbol,
      quoteSymbol: best.quoteSymbol,
      volume: vol(best),
    },
    source: "spectrum",
  };
}

/** Spectrum pools that trade this token. Used by /v1/tokens/:id/pools. */
export async function poolsForToken(
  tokenId: string,
  limit = 15
): Promise<{
  tokenId: string;
  pools: Array<{
    id: string;
    baseId: string;
    baseSymbol: string;
    quoteId: string;
    quoteSymbol: string;
    lastPrice: number;
    volume: number;
  }>;
  source: string;
}> {
  const id = tokenId === "ERG" ? ERG_ZERO : tokenId;
  const markets = await fetchSpectrumMarkets().catch(() => [] as SpectrumMarket[]);
  const pools = markets
    .filter((m) => m.baseId === id || m.quoteId === id)
    .map((m) => ({
      id: m.id,
      baseId: m.baseId,
      baseSymbol: m.baseSymbol,
      quoteId: m.quoteId,
      quoteSymbol: m.quoteSymbol,
      lastPrice: Number(m.lastPrice) || 0,
      volume: vol(m),
    }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, Math.min(40, Math.max(1, limit)));
  return { tokenId: id, pools, source: "spectrum" };
}

// ─── Token search (name) ────────────────────────────────────────────────────

export interface TokenSearchHit {
  tokenId: string;
  name: string | null;
  description?: string | null;
  decimals: number;
  emissionAmount?: number | string | null;
  boxId?: string | null;
  source: "explorer" | "known" | "spectrum";
  platform?: string | null;
  category?: string | null;
  priceUsd?: number | null;
}

export async function searchTokensByName(q: string, limit = 24): Promise<TokenSearchHit[]> {
  const query = q.trim();
  if (!query || query.length < 1) return [];
  const ql = query.toLowerCase();
  const hits: TokenSearchHit[] = [];
  const seen = new Set<string>();

  // 1) Known catalog (instant)
  for (const [id, meta] of Object.entries(KNOWN_TOKENS)) {
    if (meta.name.toLowerCase().includes(ql) || id.startsWith(ql)) {
      seen.add(id);
      hits.push({
        tokenId: id,
        name: meta.name,
        decimals: 0,
        source: "known",
        platform: meta.platform ?? null,
        category: meta.category ?? null,
      });
    }
  }

  // 2) Spectrum symbols
  try {
    const markets = await fetchSpectrumMarkets();
    for (const m of markets) {
      for (const [sym, id] of [
        [m.baseSymbol, m.baseId],
        [m.quoteSymbol, m.quoteId],
      ] as const) {
        if (id === ERG_ZERO) continue;
        if (!sym.toLowerCase().includes(ql)) continue;
        if (seen.has(id)) continue;
        seen.add(id);
        hits.push({
          tokenId: id,
          name: sym,
          decimals: 0,
          source: "spectrum",
        });
        if (hits.length >= limit * 2) break;
      }
      if (hits.length >= limit * 2) break;
    }
  } catch {
    /* */
  }

  // Official explorer HTTP is not a live source. Index search is /v1/tokens/search.

  // Prefer exact name matches first, then known, then rest
  hits.sort((a, b) => {
    const an = (a.name ?? "").toLowerCase();
    const bn = (b.name ?? "").toLowerCase();
    const ae = an === ql ? 0 : an.startsWith(ql) ? 1 : 2;
    const be = bn === ql ? 0 : bn.startsWith(ql) ? 1 : 2;
    if (ae !== be) return ae - be;
    const as = a.source === "known" ? 0 : a.source === "spectrum" ? 1 : 2;
    const bs = b.source === "known" ? 0 : b.source === "spectrum" ? 1 : 2;
    return as - bs;
  });

  // Attach prices for top hits (best effort, limited concurrency)
  const top = hits.slice(0, limit);
  await Promise.all(
    top.slice(0, 8).map(async (h) => {
      try {
        const p = await priceForToken(h.tokenId, h.name);
        h.priceUsd = p.priceUsd;
      } catch {
        /* */
      }
    })
  );

  return top;
}

// ─── Rich list ──────────────────────────────────────────────────────────────

export interface RichListEntry {
  rank: number;
  address: string;
  balanceNano: number;
  balanceErg: number;
  balanceUsd: number | null;
  sharePct: number | null;
  isContract: boolean;
  label?: string | null;
}

/** Well-known large holders / treasuries (optional labels) */
const ADDRESS_LABELS: Record<string, string> = {
  // leave sparse — labels are best-effort
};

export async function fetchRichList(limit = 50, p2pkOnly = false): Promise<{
  items: RichListEntry[];
  ergUsd: number;
  source: string;
  ts: number;
}> {
  const page = await getAddressesPage({ limit, p2pkOnly });
  const { usd: ergUsd } = await fetchErgUsd();
  const decorated = withAddressListMarket(page?.items ?? [], ergUsd);
  const items: RichListEntry[] = decorated.map((row) => {
    const balanceErg = nanoToErgApprox(row.nanoerg);
    const asNum = Number(row.nanoerg);
    return {
      rank: row.rank,
      address: row.address,
      balanceNano: Number.isFinite(asNum) ? asNum : 0,
      balanceErg,
      balanceUsd: row.balanceUsd,
      sharePct: row.sharePct,
      isContract: row.isContract,
      label: ADDRESS_LABELS[row.address] ?? null,
    };
  });
  return {
    items,
    ergUsd,
    source: "lumen",
    ts: Date.now(),
  };
}
