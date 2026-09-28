import assert from "node:assert/strict";
import { test } from "node:test";
import { n2tErgVolume, poolVolMaxErg } from "./pool-roll.js";

const ERG = "0".repeat(64);

test("N2T volume follows the Spectrum tile cap", () => {
  assert.equal(n2tErgVolume("spectrum_cfmm", ERG, 12.5, 3, 3000), 12.5);
  assert.equal(n2tErgVolume("spectrum_cfmm", ERG, 3001, 3, 3000), 0);
  assert.equal(n2tErgVolume("spectrum_cfmm", ERG, 10, 0, 3000), 0);
  assert.equal(n2tErgVolume("spectrum_cfmm", null, 4, 1, 3000), 4);
});

test("N2N does not add an ERG volume", () => {
  assert.equal(n2tErgVolume("spectrum_n2n", "ab".repeat(32), 9, 9, 3000), null);
  assert.equal(n2tErgVolume("lithos_dex", ERG, 9, 1, 3000), null);
});

test("volume cap defaults to the ranks cap", () => {
  assert.equal(poolVolMaxErg(undefined), 3000);
  assert.equal(poolVolMaxErg("2500"), 2500);
  assert.equal(poolVolMaxErg("nope"), 3000);
});
