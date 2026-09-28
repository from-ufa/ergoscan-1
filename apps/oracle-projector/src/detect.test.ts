import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyOracleTokenAmount, isOracleSeatBox, uniqueOracleSeats } from "./detect.js";

test("oracle token amount=1 is a seat, stacks are stock", () => {
  assert.equal(classifyOracleTokenAmount(1), "seat");
  assert.equal(classifyOracleTokenAmount("1"), "seat");
  assert.equal(classifyOracleTokenAmount(12), "stock");
  assert.equal(classifyOracleTokenAmount("12.0"), "stock");
  assert.equal(classifyOracleTokenAmount(0), "skip");
  assert.equal(classifyOracleTokenAmount(null), "skip");
});

test("a seat needs R4 P2PK address — amount=1 alone is not an operator", () => {
  assert.equal(
    isOracleSeatBox({
      boxId: "ab".repeat(32),
      address: "9op",
      height: 1,
      tsMs: null,
      quote: 1,
      r4Nano: null,
      epoch: null,
      valueNano: "1",
      creationTxId: null,
    }),
    true
  );
  assert.equal(
    isOracleSeatBox({
      boxId: "cd".repeat(32),
      address: null,
      height: 1,
      tsMs: null,
      quote: 1,
      r4Nano: null,
      epoch: null,
      valueNano: "1",
      creationTxId: null,
    }),
    false
  );
});

test("seats collapse to one mark per P2PK, newest box wins", () => {
  const rows = uniqueOracleSeats([
    { address: "9a", boxId: "aa", height: 10 },
    { address: "9a", boxId: "bb", height: 40 },
    { address: "9b", boxId: "cc", height: 20 },
    { address: null, boxId: "dd", height: 1 },
    { address: null, boxId: "ee", height: 2 },
  ]);
  assert.deepEqual(
    rows.map((r) => r.boxId),
    ["bb", "cc", "ee", "dd"]
  );
});
