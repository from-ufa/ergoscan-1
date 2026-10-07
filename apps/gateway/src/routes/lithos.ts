import type { Express } from "express";
import { cacheList, cacheNoStore } from "../lib/httpCache.js";
import { getLithosProtocolPage, parseLithosCursor } from "../lib/lithosPage.js";

export function registerLithosRoutes(app: Express): void {
  app.get("/v1/lithos", async (req, res) => {
    const cursor = parseLithosCursor(req.query.cursor);
    const page = await getLithosProtocolPage(cursor);
    if (!page) {
      cacheNoStore(res);
      res.status(503).json({ error: "stale", stale: true });
      return;
    }
    cacheList(res);
    res.json(page);
  });
}
