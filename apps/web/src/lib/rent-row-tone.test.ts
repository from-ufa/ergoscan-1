import assert from "node:assert/strict";
import { test } from "node:test";
import { RENT_SOON_BLOCKS, rentRowTone } from "./rent-row-tone.ts";

test("due now is waiting, 1–20 is soon, after 20 is later", () => {
  assert.equal(rentRowTone({ rentDue: true, blocksUntilRent: 0 }), "due");
  assert.equal(rentRowTone({ rentDue: false, blocksUntilRent: 0 }), "due");
  assert.equal(rentRowTone({ rentDue: false, blocksUntilRent: 1 }), "soon");
  assert.equal(rentRowTone({ rentDue: false, blocksUntilRent: RENT_SOON_BLOCKS }), "soon");
  assert.equal(rentRowTone({ rentDue: false, blocksUntilRent: RENT_SOON_BLOCKS + 1 }), "later");
  assert.equal(rentRowTone({ rentDue: false, blocksUntilRent: 720 }), "later");
});
