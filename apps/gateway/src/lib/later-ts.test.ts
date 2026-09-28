import assert from "node:assert/strict";
import { test } from "node:test";
import { laterTs } from "./later-ts.js";

test("laterTs prefers tape over a stale summary", () => {
  const snap = Date.parse("2026-09-17T10:53:52Z");
  const tip = Date.parse("2026-09-19T10:17:25Z");
  assert.equal(laterTs(snap, tip), tip);
  assert.equal(laterTs(snap, null, undefined, tip), tip);
  assert.equal(laterTs(null, null), null);
});
