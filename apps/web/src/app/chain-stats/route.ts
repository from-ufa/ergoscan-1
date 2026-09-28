import { NextResponse } from "next/server";
import { fetchHomeSnapshot, homeToChainStats } from "@/lib/list-snapshots";

export const revalidate = 60;

/**
 * Toolbar / silent refresh. Same snapshot as home SSR.
 * Caddy sends `/api/*` to gateway — this lives at `/chain-stats` so Next serves it.
 */
export async function GET() {
  const home = await fetchHomeSnapshot();
  return NextResponse.json(homeToChainStats(home));
}
