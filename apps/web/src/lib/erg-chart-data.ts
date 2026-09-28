import { downsampleLine, toMs, type LinePoint } from "@lumen/amm-chart";
import { GATEWAY } from "@/lib/config";

const SIGUSD =
  "03faf2cb329f2e90d6d23b58d91bbb6c046aa143261cc21f52fbe2824bfcbf04";

export type ErgChartSeries = {
  price: LinePoint[];
  volume: LinePoint[];
  source: "coingecko" | "sigusd";
  error: boolean;
};

function seriesFromPairs(raw: [number, number][] | undefined): LinePoint[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p) => Array.isArray(p) && Number(p[1]) > 0)
    .map(([t, v]) => ({ t: Number(t), v: Number(v) }));
}

async function fromCoinGecko(days: number): Promise<{ price: LinePoint[]; volume: LinePoint[] }> {
  const r = await fetch(
    `https://api.coingecko.com/api/v3/coins/ergo/market_chart?vs_currency=usd&days=${days}`,
    {
      headers: {
        accept: "application/json",
        "user-agent": "ErgoScan/1.0 (+https://ergoscan.me)",
      },
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(2_500),
    }
  );
  if (!r.ok) return { price: [], volume: [] };
  const j = (await r.json()) as {
    prices?: [number, number][];
    total_volumes?: [number, number][];
  };
  return {
    price: seriesFromPairs(j.prices),
    volume: seriesFromPairs(j.total_volumes),
  };
}

async function fromSigUsd(hours: number): Promise<LinePoint[]> {
  const r = await fetch(
    `${GATEWAY}/v1/defi/price-history?tokenId=${SIGUSD}&hours=${hours}`,
    { next: { revalidate: 120 }, signal: AbortSignal.timeout(2_000) }
  );
  if (!r.ok) return [];
  const j = (await r.json()) as { points?: { t: number; priceErg?: number | null }[] };
  const raw = Array.isArray(j.points) ? j.points : [];
  return raw
    .map((p) => {
      const erg = Number(p.priceErg);
      return { t: toMs(p.t), v: erg > 0 ? 1 / erg : 0 };
    })
    .filter((p) => p.t > 0 && p.v > 0);
}

/** Same CoinGecko fetch the `/erg-chart` route uses — shared Next data cache. */
export async function fetchErgChartSeries(days = 1): Promise<ErgChartSeries> {
  const d = days === 1 || days === 30 ? days : 7;
  let source: ErgChartSeries["source"] = "coingecko";
  let cg = { price: [] as LinePoint[], volume: [] as LinePoint[] };
  try {
    cg = await fromCoinGecko(d);
  } catch {
    cg = { price: [], volume: [] };
  }
  let price = cg.price;
  let volume = cg.volume;
  if (price.length < 2) {
    const hours = Math.min(14 * 24, Math.max(24, d * 24));
    try {
      price = await fromSigUsd(hours);
    } catch {
      price = [];
    }
    volume = [];
    source = "sigusd";
  }
  const downPrice = downsampleLine(price, 31);
  const downVol = downsampleLine(volume, 31);
  return {
    price: downPrice,
    volume: downVol,
    source,
    error: downPrice.length < 2,
  };
}
