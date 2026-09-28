import assert from "node:assert/strict";
import { test } from "node:test";
import {
  circulatingErgAtHeight,
  circulatingNanoAtHeight,
  emissionAtHeight,
  minerEmissionAtHeight,
} from "./ergo-emission";

test("height 1 is 75 ERG circulating", () => {
  assert.equal(circulatingErgAtHeight(1), 75);
  assert.equal(circulatingNanoAtHeight(1), 75_000_000_000n);
});

test("closed form matches per-height miner keep", () => {
  let acc = 0n;
  for (let h = 1; h <= 800_000; h += 1) {
    if (h === 1 || h === 525_600 || h === 525_601 || h === 777_216 || h === 777_217) {
      acc = 0n;
      for (let i = 1; i <= h; i++) acc += minerEmissionAtHeight(i);
      assert.equal(circulatingNanoAtHeight(h), acc, `h=${h}`);
    }
  }
  acc = 0n;
  const H = 12_000;
  for (let i = 1; i <= H; i++) acc += minerEmissionAtHeight(i);
  assert.equal(circulatingNanoAtHeight(H), acc);
});

test("explorer supply at height 1_864_386 (2026-09-02)", () => {
  assert.equal(circulatingErgAtHeight(1_864_386), 83_391_693);
});

test("EIP-27 miner keep is emission minus 12 ERG when rate ≥ 15", () => {
  const r = emissionAtHeight(777_217);
  assert.ok(r >= 15_000_000_000n);
  assert.equal(minerEmissionAtHeight(777_217), r - 12_000_000_000n);
});
