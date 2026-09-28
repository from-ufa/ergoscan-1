import assert from "node:assert/strict";
import { test } from "node:test";
import { publicIndexerStatus, toPublicHealth, type OpsHealth } from "./public-health.js";

test("public health keeps liveness fields and drops infra", () => {
  const ops: OpsHealth = {
    ok: true,
    network: "mainnet",
    height: 12,
    lastPollOk: true,
    mock: false,
    balls: 3,
    forceMock: false,
    mockFallback: false,
    node: "http://127.0.0.1:9053",
    lastError: "poll failed",
    gateway: "ergoscan/1.0.0",
    indexer: { diskFreeGb: 12, lag: 0 },
    orderingWindow: { mode: "synthetic", note: "internal" },
    matrix: { enabled: true, url: "http://127.0.0.1:9" },
  };
  const pub = toPublicHealth(ops);
  assert.deepEqual(pub, {
    ok: true,
    network: "mainnet",
    height: 12,
    lastPollOk: true,
    mock: false,
    balls: 3,
    orderingWindow: { mode: "synthetic" },
  });
  assert.equal("node" in pub, false);
  assert.equal("indexer" in pub, false);
  assert.equal("lastError" in pub, false);
});

test("public indexer status drops disk and detail", () => {
  const pub = publicIndexerStatus({
    ok: true,
    lag: 0,
    diskFreeGb: 149.37,
    detail: "counts_skipped_fast_health",
    lastHeight: 10,
  });
  assert.deepEqual(pub, { ok: true, lag: 0, lastHeight: 10 });
});
