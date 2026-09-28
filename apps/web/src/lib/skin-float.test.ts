import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSkinFloat } from "./skin-float";

test("AdaStat paper is the default float; off is explicit", () => {
  assert.equal(parseSkinFloat("ada"), "ada");
  assert.equal(parseSkinFloat("off"), "off");
  assert.equal(parseSkinFloat(null), "ada");
  assert.equal(parseSkinFloat(undefined), "ada");
  assert.equal(parseSkinFloat("glass"), "ada");
});
