import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_DETECT_LOOKBACK,
  clampCursor,
  detectLookback,
  historyEnabled,
  planOracleTick,
  unspentMinHeight,
} from "./policy.js";

test("history stays off unless explicitly 1", () => {
  assert.equal(historyEnabled(undefined), false);
  assert.equal(historyEnabled("0"), false);
  assert.equal(historyEnabled("1"), true);
});

test("cursor never moves backward", () => {
  assert.equal(clampCursor(100, 90), 100);
  assert.equal(clampCursor(100, 110), 110);
});

test("tip plan does not walk spent boxes", () => {
  const p = planOracleTick({
    enabled: true,
    history: false,
    historyBlocks: 21_600,
    cursor: 10,
    tip: 100,
    indexerLag: 0,
    pauseAt: 2,
  });
  assert.equal(p.mode, "tip");
  assert.equal(p.includeSpent, false);
  assert.equal(p.run, true);
  assert.equal(p.nextCursor, 100);
});

test("history plan is a bounded lookback, not genesis", () => {
  const p = planOracleTick({
    enabled: true,
    history: true,
    historyBlocks: 1_000,
    cursor: 50,
    tip: 5_000,
    indexerLag: 0,
    pauseAt: 2,
  });
  assert.equal(p.mode, "history");
  assert.equal(p.includeSpent, true);
  assert.equal(p.fromHeight, 4_000);
});

test("unspent detect floor stays near tip", () => {
  assert.equal(detectLookback(undefined), DEFAULT_DETECT_LOOKBACK);
  assert.equal(unspentMinHeight(100, 20), 80);
  assert.equal(unspentMinHeight(0, 20), 0);
  assert.equal(unspentMinHeight(10, 20), 0);
});

test("indexer lag yields public.*", () => {
  const p = planOracleTick({
    enabled: true,
    history: false,
    historyBlocks: 0,
    cursor: 10,
    tip: 100,
    indexerLag: 3,
    pauseAt: 2,
  });
  assert.equal(p.mode, "tip_hold");
  assert.equal(p.run, false);
});
