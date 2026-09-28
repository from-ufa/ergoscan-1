import assert from "node:assert/strict";
import { test } from "node:test";
import { inkForCategory, majorityColorInk, majorityTxInk } from "./block-ink";

test("majorityTxInk follows the largest non-coinbase category", () => {
  const ink = majorityTxInk([
    { category: "coinbase" },
    { category: "transfer" },
    { category: "transfer" },
    { category: "token" },
  ]);
  assert.equal(ink, inkForCategory("transfer"));
});

test("majorityTxInk uses coinbase only when the block is just the reward", () => {
  const ink = majorityTxInk([{ category: "coinbase" }]);
  assert.equal(ink, inkForCategory("coinbase"));
});

test("majorityColorInk picks the most common seed color", () => {
  assert.equal(majorityColorInk(["#5B8CFF", "#2DD4BF", "#5B8CFF"]), "#5B8CFF");
});
