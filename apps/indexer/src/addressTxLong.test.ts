import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addressTxRowsFromLongBox,
  growLongSlice,
  isPgStatementTimeout,
  LONG_SLICE_MIN,
  longAddressTxSlotEnabled,
  shrinkLongSlice,
} from "./addressTxLong.js";

const ADDR = "H" + "n".repeat(524); // 525 — Rosen Cold length

test("addressTxRowsFromLongBox: create + spend", () => {
  const rows = addressTxRowsFromLongBox({
    address: ADDR,
    creation_tx_id: "aa".repeat(32),
    creation_height: "100",
    spent_tx_id: "bb".repeat(32),
    spent_height: "200",
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.height, 100);
  assert.equal(rows[1]?.height, 200);
  assert.equal(rows[0]?.address.length, 525);
});

test("addressTxRowsFromLongBox: skip short and huge", () => {
  assert.equal(
    addressTxRowsFromLongBox({
      address: "9".repeat(51),
      creation_tx_id: "x",
      creation_height: 1,
      spent_tx_id: null,
      spent_height: null,
    }).length,
    0
  );
  assert.equal(
    addressTxRowsFromLongBox({
      address: "Z".repeat(2001),
      creation_tx_id: "x",
      creation_height: 1,
      spent_tx_id: null,
      spent_height: null,
    }).length,
    0
  );
});

test("longAddressTxSlotEnabled: tip off, writer default on", () => {
  const prev = process.env.ADDRESS_TX_LONG;
  try {
    delete process.env.ADDRESS_TX_LONG;
    assert.equal(longAddressTxSlotEnabled(), true);
    process.env.ADDRESS_TX_LONG = "0";
    assert.equal(longAddressTxSlotEnabled(), false);
    process.env.ADDRESS_TX_LONG = "1";
    assert.equal(longAddressTxSlotEnabled(), true);
  } finally {
    if (prev === undefined) delete process.env.ADDRESS_TX_LONG;
    else process.env.ADDRESS_TX_LONG = prev;
  }
});

test("shrinkLongSlice: timeout never retries the same fat LIMIT", () => {
  assert.equal(shrinkLongSlice(20_000), 5_000);
  assert.equal(shrinkLongSlice(5_000), 1_250);
  assert.equal(shrinkLongSlice(1_250), 312);
  assert.equal(shrinkLongSlice(64), LONG_SLICE_MIN);
  assert.equal(shrinkLongSlice(LONG_SLICE_MIN), LONG_SLICE_MIN);
});

test("growLongSlice: recover toward cap after a commit", () => {
  assert.equal(growLongSlice(312, 4_000), 624);
  assert.equal(growLongSlice(4_000, 4_000), 4_000);
});

test("isPgStatementTimeout: 57014 and message", () => {
  assert.equal(isPgStatementTimeout({ code: "57014", message: "x" }), true);
  assert.equal(
    isPgStatementTimeout(new Error("canceling statement due to statement timeout")),
    true
  );
  assert.equal(isPgStatementTimeout(new Error("deadlock detected")), false);
});

test("addressTxRowsFromLongBox: create only", () => {
  const rows = addressTxRowsFromLongBox({
    address: ADDR,
    creation_tx_id: "cc".repeat(32),
    creation_height: 9,
    spent_tx_id: null,
    spent_height: null,
  });
  assert.deepEqual(
    rows.map((r) => r.height),
    [9]
  );
});
