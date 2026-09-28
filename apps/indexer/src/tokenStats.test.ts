import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeActivityHeights, encodeTokenBalanceTxCountCursor, parseTokenBalanceTxCountCursor } from "./tokenStats.js";

test("credit sets first once and always advances last", () => {
  assert.deepEqual(mergeActivityHeights(null, null, 100, "credit"), { first: 100, last: 100 });
  assert.deepEqual(mergeActivityHeights(100, 100, 180, "credit"), { first: 100, last: 180 });
  assert.deepEqual(mergeActivityHeights(100, 180, 90, "credit"), { first: 100, last: 180 });
});

test("debit does not move first", () => {
  assert.deepEqual(mergeActivityHeights(100, 100, 200, "debit"), { first: 100, last: 200 });
  assert.deepEqual(mergeActivityHeights(null, null, 50, "debit"), { first: null, last: 50 });
});

test("null height leaves the row alone", () => {
  assert.deepEqual(mergeActivityHeights(10, 20, null, "credit"), { first: 10, last: 20 });
  assert.deepEqual(mergeActivityHeights(10, 20, -1, "debit"), { first: 10, last: 20 });
});

test("token_balances tx_count cursor is token_id TAB address", () => {
  const raw = encodeTokenBalanceTxCountCursor("ab", "9fLYhello");
  assert.equal(raw, "ab\t9fLYhello");
  assert.deepEqual(parseTokenBalanceTxCountCursor(raw), { tokenId: "ab", address: "9fLYhello" });
  assert.deepEqual(parseTokenBalanceTxCountCursor(""), { tokenId: "", address: "" });
});
