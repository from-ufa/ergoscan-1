import assert from "node:assert/strict";
import { test } from "node:test";
import { SPECTRUM_LINKS, SPF_TOKEN_ID } from "./spectrum-links";

test("ErgoDex protocol tile keeps only the ergo-dex GitHub, not a deposit CTA", () => {
  const hrefs = SPECTRUM_LINKS.map((l) => l.href);
  assert.deepEqual(hrefs, ["https://github.com/spectrum-finance/ergo-dex"]);
  assert.equal(hrefs.some((h) => /spectrum\.fi|discord|t\.me/i.test(h)), false);
  assert.equal(hrefs.some((h) => /api\.spectrum\.fi/i.test(h)), false);
  assert.equal(SPF_TOKEN_ID.length, 64);
});
