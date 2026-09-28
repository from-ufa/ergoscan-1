import { NextResponse } from "next/server";
import { fetchErgChartSeries } from "@/lib/erg-chart-data";

export const revalidate = 120;

/**
 * Caddy sends `/api/*` to gateway :4400 — this route lives at `/erg-chart`
 * so it hits Next :4410. Same CoinGecko loader as the home spark fallback.
 */
export async function GET(req: Request) {
  const daysRaw = Number(new URL(req.url).searchParams.get("days"));
  const days = daysRaw === 1 || daysRaw === 30 ? daysRaw : 7;
  const series = await fetchErgChartSeries(days);
  return NextResponse.json({
    points: series.price,
    volume: series.volume,
    source: series.source,
    days,
  });
}
