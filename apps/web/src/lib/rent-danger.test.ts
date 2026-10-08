import assert from "node:assert/strict";
import { test } from "node:test";
import { dangerHoldingUsd, parseRentDanger } from "./rent-danger.ts";

const BOX = "a".repeat(64);
const TOKEN = "b".repeat(64);

test("parseRentDanger keeps priced rows and drops a broken id", () => {
  assert.equal(parseRentDanger(undefined), null);
  assert.deepEqual(parseRentDanger([]), []);
  const rows = parseRentDanger([
    {
      boxId: BOX,
      tokenId: TOKEN,
      amount: "2500000000",
      decimals: 4,
      priceUsd: 2,
      name: "SigUSD",
      blocksUntilRent: 12,
    },
    { boxId: "nope", tokenId: TOKEN, amount: "1" },
  ]);
  assert.equal(rows?.length, 1);
  assert.equal(rows?.[0]?.name, "SigUSD");
  assert.equal(dangerHoldingUsd(rows![0]!), 500_000);
});
