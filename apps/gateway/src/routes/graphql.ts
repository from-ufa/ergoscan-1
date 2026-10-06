import type { Express, Request, Response } from "express";
import type { RawTx } from "@ergoscan/shared";
import { cacheNoStore } from "../lib/httpCache.js";
import { parseGraphqlBody, runGraphql } from "../graphql/execute.js";
import { runNautilus, type NautilusCtx } from "../graphql/nautilus.js";
import type { GraphqlCtx } from "../graphql/resolvers.js";
import {
  isSubmitTxQuery,
  requestIp,
  takeGraphqlReadSlot,
  takeSubmitSlot,
} from "../lib/submit-tx.js";

export type GraphqlDeps = {
  getRawMempool: () => Map<string, RawTx>;
  getFullHeight: () => number | null | undefined;
  submitTx: (body: unknown) => Promise<unknown>;
  checkTx?: (body: unknown) => Promise<unknown>;
  network: string;
};

export function registerGraphqlRoutes(app: Express, deps: GraphqlDeps): void {
  const apiContour = process.env.API_CONTOUR === "1";
  const ctx: GraphqlCtx & NautilusCtx = {
    getRawMempool: deps.getRawMempool,
    getFullHeight: deps.getFullHeight,
    submitTx: deps.submitTx,
    checkTx: deps.checkTx,
    network: deps.network,
  };

  const handlePost = async (req: Request, res: Response) => {
    cacheNoStore(res);
    const parsed = parseGraphqlBody(req.body);
    if ("error" in parsed) {
      res.status(400).json({ errors: [{ message: parsed.error }] });
      return;
    }
    const ip = requestIp(req);
    const submit = isSubmitTxQuery(parsed.query);
    const slot = submit ? takeSubmitSlot(ip) : null;
    if (slot && !slot.ok) {
      res.status(429).json({
        errors: [{ message: "rate_limited" }],
        error: "rate_limited",
        retryAfterSec: slot.retryAfterSec,
      });
      return;
    }
    if (apiContour && !submit) {
      const read = takeGraphqlReadSlot(ip);
      res.setHeader("X-RateLimit-Limit", String(read.limit));
      res.setHeader(
        "X-RateLimit-Remaining",
        String(read.ok ? read.remaining : 0)
      );
      if (!read.ok) {
        res.setHeader("Retry-After", String(read.retryAfterSec));
        res.status(200).json({
          errors: [
            {
              message: "rate_limited",
              extensions: { retryAfterSec: read.retryAfterSec },
            },
          ],
          data: null,
        });
        return;
      }
    }
    try {
      const result = apiContour
        ? await runNautilus(parsed.query, parsed.variables, parsed.operationName, ctx)
        : await runGraphql(parsed.query, parsed.variables, parsed.operationName, ctx);
      res.status(200).json(result);
    } finally {
      if (slot && slot.ok) slot.release();
    }
  };

  const handleGet = (_req: Request, res: Response) => {
    cacheNoStore(res);
    res.status(405).json({
      error: "use POST",
      path: "/v1/graphql",
      note: apiContour
        ? "Wallet schema. POST { query, variables? }."
        : "Our schema on this gateway. Not nautls / SigmaSpace. Body: { query, variables? }.",
    });
  };

  for (const path of ["/graphql", "/v1/graphql"]) {
    app.post(path, handlePost);
    app.get(path, handleGet);
  }
}
