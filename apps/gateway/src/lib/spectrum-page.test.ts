import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SPECTRUM_N2T_SQL,
  SPECTRUM_VENUE_SQL,
  spectrumEventTokenSql,
  spectrumPoolTokenSql,
} from "./spectrum-page.js";

test("Spectrum token filter hits quote and base, not only token_id", () => {
  assert.match(SPECTRUM_VENUE_SQL, /spectrum_cfmm/);
  assert.match(SPECTRUM_VENUE_SQL, /spectrum_n2n/);
  assert.match(SPECTRUM_N2T_SQL, /base_id/);
  assert.equal(spectrumEventTokenSql(3), "(token_id = $3 OR base_id = $3)");
  assert.equal(
    spectrumPoolTokenSql("r", 2),
    "(r.quote_token = $2 OR r.base_token = $2)"
  );
});
