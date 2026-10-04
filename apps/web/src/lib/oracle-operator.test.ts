import assert from "node:assert/strict";
import { test } from "node:test";
import {
  oracleCouncilMesh,
  oracleCouncilWalk,
  oracleErgLow,
  oracleOperatorMarkSrc,
  oracleOperatorName,
  oracleSeedHex,
  oracleWhenLabel,
  uniqueOracleNames,
} from "./oracle-operator.js";

const A = "9gwBYpduqznLVRnDg5ksJrA3VodTvmt3jfuENMPahQHkjaZ1KBT";
const B = "9gmLjaHbzXeWEgQFuU9dyMgnBLCXRSuNBrfetw1tfc2THueZ7rW";

test("operator mark and name are stable for a P2PK", () => {
  assert.equal(oracleOperatorName(A), oracleOperatorName(A));
  assert.equal(oracleSeedHex(A), oracleSeedHex(A));
  assert.notEqual(oracleOperatorName(A), oracleOperatorName(B));
  const mark = oracleOperatorMarkSrc(A);
  assert.match(mark, /^data:image\/svg\+xml/);
  assert.equal(oracleOperatorMarkSrc(A), mark);
  assert.notEqual(oracleOperatorMarkSrc(A), oracleOperatorMarkSrc(B));
  assert.match(decodeURIComponent(mark), /<svg[\s>]/);
});

test("duplicate callsigns get a numeric tail", () => {
  const names = uniqueOracleNames([A, A]);
  assert.equal(names[0], oracleOperatorName(A));
  assert.equal(names[1], `${oracleOperatorName(A)} 2`);
});

test("ERG below 1 nanoERG unit blinks, a full ERG does not", () => {
  assert.equal(oracleErgLow("999999999"), true);
  assert.equal(oracleErgLow("1000000000"), false);
  assert.equal(oracleErgLow(null), false);
});

test("posts older than 30d read as very long ago", () => {
  const now = 1_800_000_000_000;
  assert.equal(
    oracleWhenLabel({
      tsMs: now - 31 * 86_400_000,
      height: 10,
      tipHeight: 100,
      locale: "en",
      ancient: "very long ago",
      now,
    }),
    "very long ago"
  );
  assert.notEqual(
    oracleWhenLabel({
      tsMs: now - 3600_000,
      height: 10,
      tipHeight: 100,
      locale: "en",
      ancient: "very long ago",
      now,
    }),
    "very long ago"
  );
  assert.equal(
    oracleWhenLabel({
      tsMs: null,
      height: 1,
      tipHeight: 30_000,
      locale: "en",
      ancient: "очень давно",
      now,
    }),
    "очень давно"
  );
});

test("council walk visits every seat along a neighbor", () => {
  const walk = oracleCouncilWalk(11, 4);
  const seen = new Set<number>();
  for (const e of walk) {
    seen.add(e.a);
    seen.add(e.b);
    const ac = e.a % 4;
    const ar = Math.floor(e.a / 4);
    const bc = e.b % 4;
    const br = Math.floor(e.b / 4);
    assert.equal(Math.abs(ac - bc) + Math.abs(ar - br), 1);
  }
  assert.equal(seen.size, 11);
  assert.equal(walk[0]?.a, 0);
  assert.equal(walk.at(-1)?.b, 0);
});

test("council mesh binds a row and the row below", () => {
  assert.deepEqual(oracleCouncilMesh(4, 4), [
    { a: 0, b: 1 },
    { a: 1, b: 2 },
    { a: 2, b: 3 },
  ]);
  assert.deepEqual(oracleCouncilMesh(6, 3), [
    { a: 0, b: 1 },
    { a: 0, b: 3 },
    { a: 1, b: 2 },
    { a: 1, b: 4 },
    { a: 2, b: 5 },
    { a: 3, b: 4 },
    { a: 4, b: 5 },
  ]);
});
