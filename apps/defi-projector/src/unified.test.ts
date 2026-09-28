import assert from "node:assert/strict";
import { test } from "node:test";
import { initLithosCursor, mergeTipCursors, persistCursorValue } from "./policy.js";
import { canAdvanceCursor, canAdvanceLithosCursor } from "./unified.js";

test("merge picks the slower live cursor, ignores zeros", () => {
  assert.equal(mergeTipCursors(1_874_086, 1_874_086), 1_874_086);
  assert.equal(mergeTipCursors(1_874_086, 1_874_000), 1_874_000);
  assert.equal(mergeTipCursors(0, 1_874_086), 1_874_086);
  assert.equal(mergeTipCursors(1_874_086, 0), 1_874_086);
  assert.equal(mergeTipCursors(0, 0), 0);
  assert.equal(mergeTipCursors(1_874_086, 1_874_086, 1_874_000), 1_874_000);
  assert.equal(mergeTipCursors(1_874_086, 1_874_086, 0), 1_874_086);
});

test("PG cursor keys never move backward", () => {
  assert.equal(persistCursorValue(1_874_086, 1_874_100), 1_874_100);
  assert.equal(persistCursorValue(1_874_086, 1_874_000), 1_874_086);
  assert.equal(persistCursorValue(0, 1_874_086), 1_874_086);
  assert.equal(persistCursorValue(1_874_086, 0), 1_874_086);
});

test("cursor advances only when both detects and persist succeed", () => {
  const ok = { ok: true, swaps: [] };
  const bad = { ok: false, swaps: [] };
  assert.equal(canAdvanceCursor(ok, ok, true), true);
  assert.equal(canAdvanceCursor(bad, ok, true), false);
  assert.equal(canAdvanceCursor(ok, bad, true), false);
  assert.equal(canAdvanceCursor(ok, ok, false), false);
  assert.equal(canAdvanceCursor(ok, ok, true, bad), false);
  assert.equal(canAdvanceCursor(ok, ok, true, ok), true);
});

test("Lithos persist miss does not block Spectrum", () => {
  const ok = { ok: true, swaps: [] };
  assert.equal(canAdvanceCursor(ok, ok, true, ok), true);
  assert.equal(canAdvanceLithosCursor({ ok: false, swaps: [] }, true), false);
  assert.equal(canAdvanceLithosCursor(ok, false), false);
  assert.equal(canAdvanceLithosCursor(ok, true), true);
});

test("Lithos cursor starts at birth when the pool is inside rewind", () => {
  const tip = 1_900_000;
  assert.equal(initLithosCursor(0, tip, 2_000, false, 1_899_500, 452_000), 1_899_499);
  assert.equal(initLithosCursor(0, tip, 2_000, false, 1_800_000, 452_000), tip - 2_000);
  assert.equal(initLithosCursor(1_874_000, tip, 2_000, false, 1_899_500, 452_000), 1_874_000);
  assert.equal(initLithosCursor(0, tip, 2_000, true, 800_000, 452_000), 800_000 - 1);
});
