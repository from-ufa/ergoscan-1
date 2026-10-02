/**
 * GET /v1/names/book — every named address from the ergo-names registry (exact and NFT anchor).
 * Template names are per address: see `name` on /v1/addresses/:id.
 */
import type { Express } from "express";
import { cacheList, cacheNoStore } from "../lib/httpCache.js";
import { NAMES_REGISTRY_URL, namesBook } from "../lib/names.js";

export function registerNamesRoutes(app: Express): void {
  app.get("/v1/names/book", async (_req, res) => {
    const book = await namesBook();
    if (!book) {
      cacheNoStore(res);
      res.status(503).json({ error: "stale", stale: true });
      return;
    }
    cacheList(res);
    res.json({ registry: NAMES_REGISTRY_URL, ...book, total: book.items.length });
  });
}
