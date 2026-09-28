import assert from "node:assert/strict";
import { test } from "node:test";
import { oracleSealTilt, oracleSealVariant } from "./oracle-seal";

test("same operator id always cuts the same seal", () => {
  const id = "9hyDSk1d";
  assert.equal(oracleSealVariant(id), oracleSealVariant(id));
  assert.equal(oracleSealTilt(id), oracleSealTilt(id));
});

test("different ids do not all collapse to one cut", () => {
  const cuts = new Set(
    ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map(oracleSealVariant)
  );
  assert.ok(cuts.size >= 4);
});

test("brand stays on the 8 mason cuts", () => {
  for (const id of ["pool", "op-1", "op-2", "xau", "usd"]) {
    const n = oracleSealVariant(id);
    assert.ok(n >= 0 && n <= 7);
  }
});
