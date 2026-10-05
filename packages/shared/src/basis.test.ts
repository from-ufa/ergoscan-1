import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BASIS_ERG_RESERVE_ADDRESS,
  BASIS_REFUND_BLOCKS,
  BASIS_TOKEN_RESERVE_ADDRESS,
  BASIS_TRACKER_QUIET_BLOCKS,
  basisReserveStatus,
  isBasisReserveAddress,
} from "./basis.js";

test("Basis reserve addresses are the two confirmed P2S scripts", () => {
  assert.equal(BASIS_ERG_RESERVE_ADDRESS.startsWith("3PQnJ92"), true);
  assert.equal(BASIS_ERG_RESERVE_ADDRESS.length, 942);
  assert.equal(BASIS_TOKEN_RESERVE_ADDRESS.startsWith("96HrjMft"), true);
  assert.equal(BASIS_TOKEN_RESERVE_ADDRESS.length, 1081);
  assert.equal(isBasisReserveAddress(BASIS_ERG_RESERVE_ADDRESS), true);
  assert.equal(isBasisReserveAddress("9" + "a".repeat(50)), false);
});

test("refund countdown wins, then a quiet tracker, then an open lockbox", () => {
  assert.equal(BASIS_REFUND_BLOCKS, 43200);
  assert.equal(BASIS_TRACKER_QUIET_BLOCKS, 2160);
  const refund = basisReserveStatus({
    tip: 100,
    refundHeight: "80",
    trackerHeight: 1,
  });
  assert.equal(refund.status, "refund");
  assert.equal(refund.blocksLeft, String(80 + 43200 - 100));
  assert.equal(
    basisReserveStatus({ tip: 50000, refundHeight: "80", trackerHeight: 1 }).status,
    "refundReady"
  );
  assert.equal(
    basisReserveStatus({ tip: 3000, refundHeight: null, trackerHeight: 100 }).status,
    "quiet"
  );
  assert.equal(
    basisReserveStatus({ tip: 3000, refundHeight: null, trackerHeight: 2000 }).status,
    "open"
  );
  assert.equal(
    basisReserveStatus({ tip: 3000, refundHeight: null, trackerHeight: null }).status,
    "noTracker"
  );
});
