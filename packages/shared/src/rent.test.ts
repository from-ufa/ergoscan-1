import assert from "node:assert/strict";
import { test } from "node:test";
import {
  collectableRentNano,
  estimateBoxSizeBytes,
  registerPayloadBytes,
} from "./rent.js";

test("collectable rent cannot exceed the ERG in the box", () => {
  assert.equal(collectableRentNano("351250000", "10000000"), "10000000");
  assert.equal(collectableRentNano("140000000", "1000000000"), "140000000");
  assert.equal(collectableRentNano("0", "10000000"), "0");
});

test("register payload is the hex length, not 8 bytes per key", () => {
  const regs = { R4: "0e0e", R5: "aabbccdd" };
  assert.equal(registerPayloadBytes(regs), 6);
  const flat = estimateBoxSizeBytes({
    ergoTree: "00",
    assetsCount: 0,
    registersCount: 2,
  });
  const real = estimateBoxSizeBytes({
    ergoTree: "00",
    assetsCount: 0,
    registerBytes: registerPayloadBytes(regs),
  });
  assert.equal(flat, 1 + 16 + 16);
  assert.equal(real, 1 + 16 + 6);
});
