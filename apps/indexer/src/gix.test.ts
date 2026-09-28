import assert from "node:assert/strict";
import { test } from "node:test";
import {
  gixBackfillEnabled,
  gixTipStampEnabled,
  growGixSlice,
  GIX_SLICE_MIN,
  isPgStatementTimeout,
  nextBackfillHeight,
  nextHeightAfterSlice,
  shrinkGixSlice,
} from "./gix.js";

test("gixBackfillEnabled: tip off, writer default on", () => {
  const prev = process.env.GIX_BACKFILL;
  try {
    delete process.env.GIX_BACKFILL;
    assert.equal(gixBackfillEnabled(), true);
    process.env.GIX_BACKFILL = "0";
    assert.equal(gixBackfillEnabled(), false);
    process.env.GIX_BACKFILL = "1";
    assert.equal(gixBackfillEnabled(), true);
  } finally {
    if (prev === undefined) delete process.env.GIX_BACKFILL;
    else process.env.GIX_BACKFILL = prev;
  }
});

test("gixTipStampEnabled: only after gix_v1", () => {
  assert.equal(gixTipStampEnabled(null), false);
  assert.equal(gixTipStampEnabled(""), false);
  assert.equal(gixTipStampEnabled("   "), false);
  assert.equal(gixTipStampEnabled("1758100000000"), true);
});

test("shrinkGixSlice: timeout never retries the same fat LIMIT", () => {
  assert.equal(shrinkGixSlice(4_000), 1_000);
  assert.equal(shrinkGixSlice(64), GIX_SLICE_MIN);
});

test("growGixSlice: recover toward cap", () => {
  assert.equal(growGixSlice(1_000, 4_000), 2_000);
  assert.equal(growGixSlice(4_000, 4_000), 4_000);
});

test("isPgStatementTimeout", () => {
  assert.equal(isPgStatementTimeout({ code: "57014" }), true);
  assert.equal(
    isPgStatementTimeout(new Error("canceling statement due to statement timeout")),
    true
  );
  assert.equal(isPgStatementTimeout(new Error("deadlock detected")), false);
});

test("nextHeightAfterSlice: empty or under LIMIT advances to `to`", () => {
  assert.equal(nextHeightAfterSlice(100, 140, null, 0, 4000), 140);
  assert.equal(nextHeightAfterSlice(100, 140, 139, 3999, 4000), 140);
});

test("nextHeightAfterSlice: LIMIT hit stays on last height (pg string ok)", () => {
  assert.equal(nextHeightAfterSlice(100, 140, "128", 4000, 4000), 128);
  assert.equal(nextHeightAfterSlice(100, 140, 100, 4000, 4000), 100);
});

test("nextHeightAfterSlice: never past range or before from", () => {
  assert.equal(nextHeightAfterSlice(100, 140, 999, 4000, 4000), 139);
  assert.equal(nextHeightAfterSlice(100, 140, 50, 4000, 4000), 100);
  assert.equal(nextHeightAfterSlice(100, 140, "nope", 4000, 4000), 100);
});

test("nextBackfillHeight: boxes and txs must both be done", () => {
  assert.equal(nextBackfillHeight(140, 128), 128);
  assert.equal(nextBackfillHeight(100, 140), 100);
  assert.equal(nextBackfillHeight(140, 140), 140);
});
