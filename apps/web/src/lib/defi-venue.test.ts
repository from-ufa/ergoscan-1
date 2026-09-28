import assert from "node:assert/strict";
import { test } from "node:test";
import { defiVenuePath, defiVenueQuery } from "./defi-venue";

test("Spectrum stays on /defi/spectrum, Lithos has its own path", () => {
  assert.equal(defiVenuePath("spectrum"), "/defi/spectrum");
  assert.equal(defiVenuePath("lithos_dex"), "/defi/lithos");
  assert.equal(defiVenueQuery("spectrum"), "spectrum");
  assert.equal(defiVenueQuery("lithos_dex"), "lithos_dex");
});
