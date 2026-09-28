import assert from "node:assert/strict";
import { test } from "node:test";
import { n2tTvlErg, t2tTvlErg, TVL_TOKEN_SIDE_MAX_RATIO } from "./pool-tvl.js";

test("no price keeps TVL as ERG side — do not blindly 2×", () => {
  const t = n2tTvlErg({
    valueNano: 10e9,
    quoteRaw: 50_000,
    quoteDecimals: 9,
  });
  assert.equal(t.ergSide, 10);
  assert.equal(t.tokenSide, 0);
  assert.equal(t.tvlErg, 10);
});

test("balanced last fill adds token side", () => {
  const t = n2tTvlErg({
    valueNano: 10e9,
    quoteRaw: 50_000_000_000,
    quoteDecimals: 9,
    priceErg: 0.2,
  });
  assert.equal(t.ergSide, 10);
  assert.equal(t.tokenSide, 10);
  assert.equal(t.tvlErg, 20);
});

test("stale price above max ratio drops token side", () => {
  const t = n2tTvlErg({
    valueNano: 10e9,
    quoteRaw: 50_000_000_000,
    quoteDecimals: 9,
    priceErg: TVL_TOKEN_SIDE_MAX_RATIO + 1,
  });
  assert.equal(t.ergSide, 10);
  assert.equal(t.tokenSide, 0);
  assert.equal(t.tvlErg, 10);
});

test("Lithos pendingX is not LP ERG", () => {
  const t = n2tTvlErg({
    valueNano: 10e9,
    pendingXNano: 1e9,
    pendingY: 0,
    quoteRaw: 9e9,
    quoteDecimals: 9,
    priceErg: 1,
  });
  assert.equal(t.ergSide, 9);
  assert.equal(t.tokenSide, 9);
  assert.equal(t.tvlErg, 18);
});

test("string nano above MAX_SAFE_INTEGER still subtracts pending", () => {
  const t = n2tTvlErg({
    valueNano: "10000000000000000",
    pendingXNano: "1000000000000000",
    quoteRaw: "1000000000000000000",
    quoteDecimals: 9,
    priceErg: 0.009,
  });
  assert.equal(t.ergSide, 9_000_000);
  assert.equal(t.tokenSide, 9_000_000);
  assert.equal(t.tvlErg, 18_000_000);
});

test("pending greater than box zeros ERG side", () => {
  const t = n2tTvlErg({
    valueNano: 1e9,
    pendingXNano: 2e9,
    quoteRaw: 1,
    quoteDecimals: 0,
    priceErg: 1,
  });
  assert.equal(t.tvlErg, 0);
  assert.equal(t.ergSide, 0);
});

test("T2T TVL is both reserves at N2T ERG prices — not box nano", () => {
  const t = t2tTvlErg({
    amountA: 50e9,
    decimalsA: 9,
    priceErgA: 0.2,
    amountB: 10e6,
    decimalsB: 6,
    priceErgB: 1,
  });
  assert.equal(t.sideA, 10);
  assert.equal(t.sideB, 10);
  assert.equal(t.tvlErg, 20);
});

test("T2T missing price keeps that side at 0 — do not 2×", () => {
  const t = t2tTvlErg({
    amountA: 50e9,
    decimalsA: 9,
    priceErgA: 0.2,
    amountB: 1e12,
    decimalsB: 6,
  });
  assert.equal(t.sideA, 10);
  assert.equal(t.sideB, 0);
  assert.equal(t.tvlErg, 10);
});

test("T2T stale side above max ratio is dropped", () => {
  const t = t2tTvlErg({
    amountA: 10e9,
    decimalsA: 9,
    priceErgA: 1,
    amountB: 10e9,
    decimalsB: 9,
    priceErgB: TVL_TOKEN_SIDE_MAX_RATIO + 1,
  });
  assert.equal(t.sideA, 10);
  assert.equal(t.sideB, 0);
  assert.equal(t.tvlErg, 10);
});
