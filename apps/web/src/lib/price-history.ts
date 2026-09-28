import { downsampleLine, toMs, type LinePoint, type Tick } from "@lumen/amm-chart";

type RawPoint = {
  t: number;
  priceErg?: number | null;
  tvlErg?: number | null;
};

const SIGUSD =
  "03faf2cb329f2e90d6d23b58d91bbb6c046aa143261cc21f52fbe2824bfcbf04";

/** GET /v1/defi/price-history → pool-mid ticks. Ignores tick USD (oracle sawtooth). */
export async function fetchPriceTicks(
  gateway: string,
  tokenId: string,
  hours: number
): Promise<Tick[]> {
  const r = await fetch(
    `${gateway}/v1/defi/price-history?tokenId=${encodeURIComponent(tokenId)}&hours=${hours}`
  );
  if (!r.ok) return [];
  const j = (await r.json()) as { points?: RawPoint[] };
  const raw = Array.isArray(j.points) ? j.points : [];
  return raw
    .map((p) => ({
      t: p.t,
      erg: Number(p.priceErg),
      tvlErg:
        p.tvlErg != null && Number.isFinite(Number(p.tvlErg)) ? Number(p.tvlErg) : null,
    }))
    .filter((p) => Number.isFinite(p.erg) && p.erg > 0);
}

function invertSigUsd(ticks: Tick[]): LinePoint[] {
  return downsampleLine(
    ticks
      .map((p) => ({ t: toMs(p.t), v: p.erg > 0 ? 1 / p.erg : 0 }))
      .filter((p) => p.t > 0 && p.v > 0),
    31
  );
}

/**
 * Home ERG/USD area (+ USD volume from the same CoinGecko body).
 * Next `/erg-chart` (not `/api/*` — Caddy sends `/api` to gateway).
 * Fallback: invert SigUSD pool-mid from existing price-history (no volume).
 */
export async function fetchErgChart(
  gateway: string,
  days = 7
): Promise<{ price: LinePoint[]; volume: LinePoint[] }> {
  const d = days === 1 || days === 30 ? days : 7;
  try {
    const r = await fetch(`/erg-chart?days=${d}`);
    if (r.ok) {
      const j = (await r.json()) as { points?: LinePoint[]; volume?: LinePoint[] };
      const price = (Array.isArray(j.points) ? j.points : []).filter(
        (p) => p.t > 0 && Number.isFinite(p.v) && p.v > 0
      );
      const volume = (Array.isArray(j.volume) ? j.volume : []).filter(
        (p) => p.t > 0 && Number.isFinite(p.v) && p.v >= 0
      );
      if (price.length >= 2) return { price, volume };
    }
  } catch {
    /* fall through */
  }
  const hours = Math.min(14 * 24, Math.max(24, d * 24));
  const ticks = await fetchPriceTicks(gateway, SIGUSD, hours);
  return { price: invertSigUsd(ticks), volume: [] };
}

export async function fetchErgUsdLine(
  gateway: string,
  days = 7
): Promise<LinePoint[]> {
  const { price } = await fetchErgChart(gateway, days);
  return price;
}
