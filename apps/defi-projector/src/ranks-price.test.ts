import assert from "node:assert/strict";
import { test } from "node:test";
import { pickErgUsd } from "@ergoscan/shared";

test("DeFi ranks prefer writer market snap over last tick", () => {
  assert.equal(pickErgUsd({ market: 0.61, tick: 0.4 }), 0.61);
  assert.equal(pickErgUsd({ tick: 0.4 }), 0.4);
  assert.equal(pickErgUsd({ env: 0.7, market: 0.61, tick: 0.4 }), 0.7);
});
