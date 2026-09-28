import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTrustBoard } from "./trust-board";

const NOW = Date.parse("2026-09-16T17:09:30.000Z");

const ORACLE_OK = {
  ok: true,
  ready: true,
  mode: "tip",
  scanHeight: 1874508,
  source: "lumen-oracle",
  feeds: [
    { slug: "ergusd", poolBoxId: "cc", live: 6 },
    { slug: "erg-usd", poolBoxId: "aa", live: 8 },
    { slug: "xau-erg", poolBoxId: "bb", live: 12 },
  ],
} as const;

const RENT_OK = {
  ok: true,
  ready: true,
  mode: "tip",
  verifyHeight: 1874510,
  liveHeight: 1874510,
  lag: 0,
  source: "lumen-rent",
} as const;

test("builds an operational board from the live health shapes", () => {
  const board = buildTrustBoard(
    {
      gateway: {
        ok: true,
        mock: false,
        lastPollOk: true,
        balls: 15,
        height: 1874510,
        orderingWindow: { mode: "synthetic" },
      },
      indexer: {
        ok: true,
        lag: 0,
        mode: "tip",
        span: 1874511,
        minHeight: 0,
        lastHeight: 1874510,
        backfillPct: 100,
        updatedAt: "2026-09-16T17:09:29.710Z",
        source: "snapshot",
      },
      defi: {
        ok: true,
        stale: false,
        workerLag: 2,
        scanHeight: 1874508,
        scanHeightN2t: 1874508,
        scanHeightT2t: 1874508,
        indexerHeight: 1874510,
        trades24h: 128,
        ranksAgeMs: 94935,
        source: "lumen-defi",
      },
      rosen: {
        ok: true,
        ready: true,
        scanHeight: 1874508,
        tipHeight: 1874510,
        eventsTotal: 5762,
        processing: 4,
        routes: 37,
        updatedAtMs: NOW - 20_000,
        source: "projector",
      },
      oracle: ORACLE_OK,
      rent: RENT_OK,
    },
    NOW
  );

  assert.equal(board.state, "operational");
  assert.equal(board.slices.length, 6);
  assert.equal(board.slices[5]?.id, "rent");
  assert.equal(board.slices[5]?.state, "operational");
  assert.deepEqual(board.slices[0]?.notices, ["synthetic-ordering"]);
  assert.deepEqual(board.slices[1]?.notices, []);
  assert.equal(board.slices[1]?.evidence, "chain");
  assert.equal(board.slices[2]?.evidence, "decoded");
  assert.equal(board.slices[3]?.state, "operational");
  assert.equal(board.slices[4]?.id, "oracle");
  assert.equal(board.slices[4]?.state, "operational");
  assert.deepEqual(
    board.slices[4]?.feeds?.map((f) => [f.slug, f.live]),
    [
      ["ergusd", 6],
      ["erg-usd", 8],
      ["xau-erg", 12],
    ]
  );
});

test("surfaces partial coverage and stale protocol data", () => {
  const board = buildTrustBoard(
    {
      gateway: { ok: true, lastPollOk: true, height: 200, balls: 0 },
      indexer: {
        ok: true,
        lag: 0,
        minHeight: 100,
        lastHeight: 200,
        backfillPct: 50,
        updatedAt: new Date(NOW - 1_000).toISOString(),
      },
      defi: {
        ok: true,
        stale: true,
        workerLag: 0,
        scanHeight: 200,
        scanHeightN2t: 200,
        scanHeightT2t: 200,
        indexerHeight: 200,
      },
      rosen: {
        ok: true,
        ready: false,
        scanHeight: 200,
        tipHeight: 200,
        updatedAtMs: NOW - 1_000,
      },
      oracle: {
        ok: true,
        ready: false,
        mode: "tip",
        scanHeight: 200,
        feeds: [],
      },
      rent: RENT_OK,
    },
    NOW
  );

  assert.equal(board.state, "degraded");
  assert.equal(board.slices[1]?.state, "catching-up");
  assert.deepEqual(board.slices[1]?.notices, ["partial-chain"]);
  assert.equal(board.slices[2]?.state, "degraded");
  assert.deepEqual(board.slices[2]?.notices, ["stale"]);
  assert.equal(board.slices[3]?.state, "catching-up");
  assert.deepEqual(board.slices[3]?.notices, ["not-ready"]);
  assert.equal(board.slices[4]?.state, "catching-up");
  assert.deepEqual(board.slices[4]?.notices, ["not-ready"]);
});

test("fails closed for mock, malformed, and frozen health snapshots", () => {
  const board = buildTrustBoard(
    {
      gateway: {
        ok: true,
        mock: true,
        lastPollOk: true,
        height: 100,
        balls: 0,
      },
      indexer: {
        ok: true,
        lag: 0,
        minHeight: 0,
        lastHeight: 100,
        backfillPct: 100,
        updatedAt: new Date(NOW - 61_000).toISOString(),
      },
      defi: {
        ok: true,
        stale: false,
        workerLag: 0,
        scanHeight: 100,
        scanHeightN2t: 100,
        scanHeightT2t: 100,
        indexerHeight: 100,
      },
      rosen: {
        ok: true,
        ready: true,
        scanHeight: 100,
        tipHeight: 100,
        updatedAtMs: NOW - 121_000,
      },
      oracle: {
        ok: true,
        ready: true,
        mode: "tip",
        scanHeight: 100,
      },
      rent: RENT_OK,
    },
    NOW
  );

  assert.equal(board.state, "degraded");
  assert.equal(board.slices[0]?.state, "degraded");
  assert.equal(board.slices[1]?.state, "degraded");
  assert.ok(board.slices[1]?.notices.includes("stale"));
  assert.equal(board.slices[2]?.state, "degraded");
  assert.ok(board.slices[2]?.notices.includes("stale"));
  assert.equal(board.slices[3]?.state, "degraded");
  assert.ok(board.slices[3]?.notices.includes("stale"));
});

test("degrades writers that claim to be ahead of their upstream", () => {
  const board = buildTrustBoard(
    {
      gateway: {
        ok: true,
        lastPollOk: true,
        height: 100,
        balls: 0,
      },
      indexer: {
        ok: true,
        lag: -10,
        minHeight: 0,
        lastHeight: 110,
        backfillPct: 100,
        updatedAt: new Date(NOW - 1_000).toISOString(),
      },
      defi: {
        ok: true,
        stale: false,
        workerLag: -10,
        scanHeight: 110,
        scanHeightN2t: 110,
        scanHeightT2t: 90,
        indexerHeight: 100,
        ranksAgeMs: -70_000,
      },
      rosen: {
        ok: true,
        ready: true,
        scanHeight: 110,
        tipHeight: 100,
        updatedAtMs: NOW - 1_000,
      },
      oracle: {
        ok: true,
        ready: true,
        mode: "tip",
        scanHeight: 110,
      },
      rent: { ok: false, ready: false, mode: "history" },
    },
    NOW
  );

  for (const slice of board.slices.slice(1)) {
    assert.equal(slice.state, "degraded");
    if (slice.id !== "rent") assert.ok(slice.notices.includes("inconsistent"));
  }
});

test("keeps missing services explicit instead of manufacturing healthy data", () => {
  const board = buildTrustBoard(
    { gateway: null, indexer: null, defi: null, rosen: null, oracle: null, rent: null },
    NOW
  );

  assert.equal(board.state, "unavailable");
  assert.ok(board.slices.every((slice) => slice.state === "unavailable"));
  assert.ok(
    board.slices.every((slice) => slice.notices.includes("endpoint-unavailable"))
  );
});
