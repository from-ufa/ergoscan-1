import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BATCH_MIN,
  batchForLag,
  clampCursorToFloor,
  historyAllowed,
  indexerTooFarBehind,
  liveIndexerLag,
  nextBatch,
  planRosenTick,
  requireGenesisFromEnv,
  shouldApplyLateSpends,
  shouldRefreshKpis,
  tickSleepMs,
} from "./policy.js";

test("requireGenesis stays on unless explicitly disabled", () => {
  assert.equal(requireGenesisFromEnv(undefined), true);
  assert.equal(requireGenesisFromEnv(""), true);
  assert.equal(requireGenesisFromEnv("1"), true);
  assert.equal(requireGenesisFromEnv("0"), false);
  assert.equal(requireGenesisFromEnv("false"), false);
});

test("history walk waits for genesis when required", () => {
  assert.equal(historyAllowed(1_500_000, true), false);
  assert.equal(historyAllowed(0, true), true);
  assert.equal(historyAllowed(-1, true), true);
  assert.equal(historyAllowed(1_500_000, false), true);
});

test("indexer lag hold ignores missing snapshots", () => {
  assert.equal(indexerTooFarBehind(null, 2), false);
  assert.equal(indexerTooFarBehind(Number.NaN, 2), false);
  assert.equal(indexerTooFarBehind(2, 2), false);
  assert.equal(indexerTooFarBehind(3, 2), true);
});

test("live lag prefers indexer_state last_height over snapshot", () => {
  assert.equal(liveIndexerLag(100, 98, 40), 2);
  assert.equal(liveIndexerLag(100, null, 7), 7);
  assert.equal(liveIndexerLag(100, null, null), null);
});

test("genesis_hold does not walk address_tx and does not move the cursor", () => {
  const plan = planRosenTick({
    minHeight: 1_500_000,
    requireGenesis: true,
    indexerLag: 40,
    pauseAt: 2,
    cursor: 1_099_999,
    safeTip: 1_600_000,
    batch: 40,
    trail: 16,
    floor: 1_500_000,
  });
  assert.equal(plan.mode, "genesis_hold");
  assert.equal(plan.detect, null);
  assert.equal(plan.advanceCursor, false);
  assert.equal(plan.nextCursor, 1_099_999);
});

test("after genesis the cursor stays at the contract floor, not min_height", () => {
  const plan = planRosenTick({
    minHeight: 0,
    requireGenesis: true,
    indexerLag: 0,
    pauseAt: 2,
    cursor: 1_099_999,
    safeTip: 1_600_000,
    batch: 40,
    trail: 16,
    floor: 1_100_000,
  });
  assert.equal(plan.mode, "history");
  assert.deepEqual(plan.detect, { from: 1_100_000, to: 1_100_039 });
  assert.equal(plan.advanceCursor, true);
  assert.equal(plan.nextCursor, 1_100_039);
});

test("tip_hold yields the detect window when the indexer is catching tip", () => {
  const plan = planRosenTick({
    minHeight: 0,
    requireGenesis: true,
    indexerLag: 12,
    pauseAt: 2,
    cursor: 1_500_000,
    safeTip: 1_600_000,
    batch: 40,
    trail: 16,
    floor: 1_100_000,
  });
  assert.equal(plan.mode, "tip_hold");
  assert.equal(plan.detect, null);
  assert.equal(plan.advanceCursor, false);
});

test("tip trail rescan does not walk below the floor", () => {
  const plan = planRosenTick({
    minHeight: 0,
    requireGenesis: true,
    indexerLag: 0,
    pauseAt: 2,
    cursor: 1_599_970,
    safeTip: 1_600_000,
    batch: 40,
    trail: 16,
    floor: 1_100_000,
  });
  assert.equal(plan.mode, "tip");
  assert.deepEqual(plan.detect, { from: 1_599_955, to: 1_600_000 });
  assert.equal(plan.nextCursor, 1_600_000);
});

test("forcing history before genesis clamps onto the indexed floor", () => {
  assert.equal(clampCursorToFloor(1_099_999, 1_500_000), 1_499_999);
  const plan = planRosenTick({
    minHeight: 1_500_000,
    requireGenesis: false,
    indexerLag: 0,
    pauseAt: 2,
    cursor: 1_099_999,
    safeTip: 1_600_000,
    batch: 40,
    trail: 16,
    floor: 1_500_000,
  });
  assert.equal(plan.mode, "history");
  assert.deepEqual(plan.detect, { from: 1_500_000, to: 1_500_039 });
});

test("late spends only run on the tip follow, not on holds or history", () => {
  assert.equal(shouldApplyLateSpends("tip"), true);
  assert.equal(shouldApplyLateSpends("history"), false);
  assert.equal(shouldApplyLateSpends("tip_hold"), false);
  assert.equal(shouldApplyLateSpends("genesis_hold"), false);
});

test("KPIs skip while yielding and throttle on a live walk", () => {
  assert.equal(shouldRefreshKpis("tip_hold", 0, 10_000, 30_000), false);
  assert.equal(shouldRefreshKpis("genesis_hold", 0, 10_000, 30_000), false);
  assert.equal(shouldRefreshKpis("history", 0, 10_000, 30_000), false);
  assert.equal(shouldRefreshKpis("history", 0, 31_000, 30_000), true);
  assert.equal(shouldRefreshKpis("tip", 0, 31_000, 30_000), true);
});

test("sleep backs off on hold and detect timeout", () => {
  assert.equal(tickSleepMs(4_000, "history", false), 4_000);
  assert.equal(tickSleepMs(4_000, "tip", true), 8_000);
  assert.equal(tickSleepMs(4_000, "tip_hold", false), 8_000);
  assert.equal(tickSleepMs(4_000, "genesis_hold", false), 30_000);
});

test("batch shrinks on timeout and when the indexer is 1 behind", () => {
  assert.equal(nextBatch(40, 40, true), 20);
  assert.equal(nextBatch(8, 40, true), BATCH_MIN);
  assert.equal(nextBatch(20, 40, false), 25);
  assert.equal(batchForLag(40, 0), 40);
  assert.equal(batchForLag(40, 1), 16);
  assert.equal(batchForLag(40, null), 40);
});
