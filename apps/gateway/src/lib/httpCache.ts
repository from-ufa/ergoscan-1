/**
 * Edge cache policy for snapshot reads.
 * Browser max-age=0 (always revalidate). Shared cache (Caddy/CDN) uses s-maxage + SWR.
 * Tip refetch adds ?h=<height> so a shared cache cannot serve the previous tip.
 */
import type { Response } from "express";

/** List snapshots: 2–6s at the edge. */
export function cacheList(res: Response): void {
  res.setHeader(
    "Cache-Control",
    "public, max-age=0, s-maxage=3, stale-while-revalidate=6"
  );
}

/** Token / DeFi ranks: 15–30s at the edge. */
export function cacheTokens(res: Response): void {
  res.setHeader(
    "Cache-Control",
    "public, max-age=0, s-maxage=15, stale-while-revalidate=30"
  );
}

/** Tip / indexer status: short TTL. */
export function cacheTip(res: Response): void {
  res.setHeader(
    "Cache-Control",
    "public, max-age=0, s-maxage=1, stale-while-revalidate=2"
  );
}

/** Mempool, address, 503, personalized filters — never store. */
export function cacheNoStore(res: Response): void {
  res.setHeader("Cache-Control", "private, no-store");
}
