import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BATCH_MIN,
  clampCursorIfNeeded,
  initCursor,
  mergeTipCursors,
  nextBatch,
  persistCursorValue,
  planDefiTick,
  shouldMaterializeRanks,
} from "./policy.js";

test("history does not clamp a low cursor to tip", () => {
  const tip = 1_872_000;
  const low = 452_000;
  assert.equal(clampCursorIfNeeded(low, tip, 2_000, true).clamped, false);
  assert.equal(clampCursorIfNeeded(low, tip, 2_000, true).cursor, low);
  const tipMode = clampCursorIfNeeded(low, tip, 2_000, false);
  assert.equal(tipMode.clamped, true);
  assert.equal(tipMode.cursor, tip - 2_000);
});

test("history init uses FROM-1, never tip-rewind", () => {
  assert.equal(initCursor(0, 1_872_000, 2_000, true, 452_000), 451_999);
  assert.equal(initCursor(400_000, 1_872_000, 2_000, true, 452_000), 451_999);
  assert.equal(initCursor(800_000, 1_872_000, 2_000, true, 452_000), 800_000);
  assert.equal(initCursor(0, 1_872_000, 2_000, false, 452_000), 1_870_000);
});

test("history windows have no trail overlap; tip windows do", () => {
  const hist = planDefiTick({
    cursor: 500_000,
    safeTip: 1_870_000,
    batch: 100,
    trail: 16,
    floor: 452_000,
    indexerLag: 0,
    pauseAt: 2,
  });
  assert.equal(hist.mode, "history");
  assert.equal(hist.from, 500_001);
  assert.equal(hist.to, 500_100);

  const tip = planDefiTick({
    cursor: 1_869_980,
    safeTip: 1_870_000,
    batch: 40,
    trail: 16,
    floor: 452_000,
    indexerLag: 0,
    pauseAt: 2,
  });
  assert.equal(tip.mode, "tip");
  assert.equal(tip.from, 1_869_981 - 16);
  assert.equal(tip.to, 1_870_000);
});

test("detect timeout halves the bite down to 1 height", () => {
  assert.equal(nextBatch(100, 100, true), 50);
  assert.equal(nextBatch(50, 100, true), 25);
  assert.equal(nextBatch(2, 100, true), BATCH_MIN);
  assert.equal(nextBatch(1, 100, true), BATCH_MIN);
  assert.equal(nextBatch(50, 100, false), 62);
});

test("timeout recovery may plan a 1-height window", () => {
  const one = planDefiTick({
    cursor: 610_099,
    safeTip: 1_870_000,
    batch: 1,
    trail: 16,
    floor: 452_000,
    indexerLag: 0,
    pauseAt: 2,
  });
  assert.equal(one.mode, "history");
  assert.equal(one.from, 610_100);
  assert.equal(one.to, 610_100);
  assert.equal(one.nextCursor, 610_100);
});

test("pause when indexer lag is above the line", () => {
  const hold = planDefiTick({
    cursor: 500_000,
    safeTip: 1_870_000,
    batch: 100,
    trail: 16,
    floor: 452_000,
    indexerLag: 5,
    pauseAt: 2,
  });
  assert.equal(hold.mode, "tip_hold");
  assert.equal(hold.from, null);
});

test("ranks stay quiet while catching up", () => {
  assert.equal(
    shouldMaterializeRanks({
      now: 1_800_000,
      lastRanksAt: 0,
      ranksMs: 90_000,
      historyRanksMs: 1_800_000,
      scanLag: 800_000,
      nearTip: 500,
    }),
    true
  );
  assert.equal(
    shouldMaterializeRanks({
      now: 100_000,
      lastRanksAt: 0,
      ranksMs: 90_000,
      historyRanksMs: 1_800_000,
      scanLag: 800_000,
      nearTip: 500,
    }),
    false
  );
  assert.equal(
    shouldMaterializeRanks({
      now: 91_000,
      lastRanksAt: 0,
      ranksMs: 90_000,
      historyRanksMs: 1_800_000,
      scanLag: 10,
      nearTip: 500,
    }),
    true
  );
});
