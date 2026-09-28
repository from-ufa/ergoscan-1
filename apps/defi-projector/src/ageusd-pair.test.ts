import assert from "node:assert/strict";
import { test } from "node:test";
import { SIGRSV_TOKEN_ID, SIGUSD_TOKEN_ID } from "@ergoscan/shared";
import { classifyAgeUsdBankDelta } from "./ageusd-pair.js";

test("mint SigUSD: bank +ERG −USD", () => {
  const ops = classifyAgeUsdBankDelta(5e9, -200_00, 0);
  assert.equal(ops.length, 1);
  assert.equal(ops[0]?.side, "mint");
  assert.equal(ops[0]?.tokenId, SIGUSD_TOKEN_ID);
  assert.equal(ops[0]?.eventKind, "mint_usd");
  assert.equal(ops[0]?.tokenRaw, 200_00);
  assert.equal(ops[0]?.ergNano, 5e9);
});

test("redeem SigUSD: bank −ERG +USD", () => {
  const ops = classifyAgeUsdBankDelta(-3e9, 150_00, 0);
  assert.equal(ops.length, 1);
  assert.equal(ops[0]?.side, "redeem");
  assert.equal(ops[0]?.eventKind, "redeem_usd");
});

test("mint SigRSV: bank +ERG −RSV", () => {
  const ops = classifyAgeUsdBankDelta(2e9, 0, -40);
  assert.equal(ops[0]?.tokenId, SIGRSV_TOKEN_ID);
  assert.equal(ops[0]?.eventKind, "mint_rsv");
});

test("oracle-only and mixed signs are not trades", () => {
  assert.deepEqual(classifyAgeUsdBankDelta(1e6, 0, 0), []);
  assert.deepEqual(classifyAgeUsdBankDelta(2e9, -100, 50), []);
});
