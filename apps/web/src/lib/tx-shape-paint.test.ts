import assert from "node:assert/strict";
import { test } from "node:test";
import { MINERS_FEE_ADDRESS } from "@ergoscan/shared";
import { paintTxSnapshot } from "./tx-shape-paint";

test("stale transfer paint becomes fee-collect from I/O", () => {
  const painted = paintTxSnapshot({
    id: "b06c",
    confirmed: true,
    inclusionHeight: 1874535,
    numConfirmations: 1,
    size: 135,
    fee: 0,
    category: "transfer",
    shape: "transfer",
    indexInBlock: 3,
    inputs: [
      { address: MINERS_FEE_ADDRESS, value: "1500000", assets: [] },
      { address: MINERS_FEE_ADDRESS, value: "1100000", assets: [] },
    ],
    outputs: [
      {
        address: `88${"a".repeat(50)}`,
        value: "2600000",
        assets: [],
      },
    ],
    ball: { feeRate: 0, inputCount: 2, outputCount: 1, category: "transfer" },
  });
  assert.equal(painted.category, "fee-collect");
  assert.equal(painted.shape, "fee-collect");
  assert.equal(painted.protocol, "miner-fee");
  assert.equal(painted.ball?.category, "fee-collect");
  assert.equal(painted.ball?.platform, undefined);
});

test("rent mark survives the I/O shape repaint", () => {
  const painted = paintTxSnapshot({
    category: "transfer",
    shape: "transfer",
    rent: "rent",
    indexInBlock: 4,
    inputs: [{ address: "9".repeat(51), value: "1000000", assets: [] }],
    outputs: [
      { address: MINERS_FEE_ADDRESS, value: "100000", assets: [] },
      { address: "9".repeat(51), value: "900000", assets: [] },
    ],
    ball: { feeRate: 1, inputCount: 1, outputCount: 2, category: "transfer", color: "#5B8CFF" },
  });
  assert.equal(painted.category, "rent");
  assert.equal(painted.shape, "transfer");
  assert.equal(painted.rent, "rent");
  assert.equal(painted.ball?.category, "rent");
  assert.equal(painted.ball?.color, "#ff4d4d");
});

test("incomplete assets keep the stored shape", () => {
  const painted = paintTxSnapshot({
    category: "token",
    shape: "token",
    assetsComplete: false,
    indexInBlock: 2,
    inputs: [{ address: "9".repeat(51), value: "1", assets: [] }],
    outputs: [{ address: "9".repeat(51), value: "1", assets: [] }],
  });
  assert.equal(painted.category, "token");
  assert.equal(painted.shape, "token");
});
