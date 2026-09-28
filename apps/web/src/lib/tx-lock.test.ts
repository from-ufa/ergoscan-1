import assert from "node:assert/strict";
import { test } from "node:test";
import { lockCaption } from "./tx-lock";

const COPY: Record<string, string> = {
  "tx.lock.oracle": "Oracle",
  "tx.protocol.miner-fee": "Miner fee",
};

function t(k: string): string {
  return COPY[k] ?? k;
}

test("lock family wins the overlay caption", () => {
  assert.equal(lockCaption("oracle", t), "Oracle");
});

test("monetary protocol is the overlay when there is no lock", () => {
  assert.equal(lockCaption("miner-fee", t), "Miner fee");
});

test("unknown overlay id passes through", () => {
  assert.equal(lockCaption("not-a-class", t), "not-a-class");
});

test("empty overlay is omitted", () => {
  assert.equal(lockCaption(null, t), null);
});
