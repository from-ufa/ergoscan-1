import assert from "node:assert/strict";
import { test } from "node:test";
import { MINERS_FEE_ADDRESS } from "@ergoscan/shared";
import { explainTransaction } from "./tx-explain";

const A = "9address-a";
const B = "9address-b";

test("explains a complete indexed transfer without inventing intent", () => {
  const result = explainTransaction({
    confirmed: true,
    source: "indexer",
    size: 500,
    fee: "1000000",
    category: "transfer",
    inputCount: 1,
    outputCount: 2,
    inputs: [{ boxId: "in", value: "1000000000", address: A, assets: [] }],
    outputs: [
      { boxId: "out", value: "999000000", address: B, assets: [] },
      { boxId: "fee", value: "1000000", address: MINERS_FEE_ADDRESS, assets: [] },
    ],
  });

  assert.equal(result.source, "index");
  assert.equal(result.coverage, "complete");
  assert.equal(result.shape, "transfer");
  assert.equal(result.feeNano, 1000000n);
  assert.equal(result.feeEvidence, "contract");
  assert.equal(result.feeOutputCount, 1);
  assert.equal(result.nonFeeOutputNano, 999000000n);
  assert.equal(result.inputAddressCount, 1);
  assert.equal(result.outputAddressCount, 1);
  assert.deepEqual(result.limits, []);
});

test("marks an unconfirmed transaction as live RAM evidence", () => {
  const result = explainTransaction({
    confirmed: false,
    source: "mempool",
    category: "token",
    inputs: [],
    outputs: [],
  });

  assert.equal(result.source, "ram");
  assert.equal(result.confirmed, false);
  assert.equal(result.coverage, "unknown");
  assert.deepEqual(result.limits, ["unknown-io-coverage"]);
});

test("does not claim token changes from partial IO", () => {
  const result = explainTransaction({
    confirmed: true,
    inputCount: 2,
    outputCount: 1,
    inputs: [
      {
        boxId: "in",
        value: "1",
        address: A,
        assets: [{ tokenId: "aa", amount: "10" }],
      },
    ],
    outputs: [{ boxId: "out", value: "1", address: B, assets: [] }],
  });

  assert.equal(result.coverage, "partial");
  assert.equal(result.shape, "unknown");
  assert.deepEqual(result.tokenChanges, []);
  assert.deepEqual(result.limits, ["partial-io"]);
});

test("does not call unresolved mempool assets a mint", () => {
  const result = explainTransaction({
    confirmed: false,
    source: "mempool",
    inputCount: 1,
    outputCount: 1,
    inputs: [{ boxId: "mint", value: null, address: A }],
    outputs: [
      {
        boxId: "out",
        value: "1",
        address: B,
        assets: [{ tokenId: "mint", amount: "20" }],
      },
    ],
  });

  assert.equal(result.coverage, "partial");
  assert.equal(result.resolvedInputs, 0);
  assert.deepEqual(result.tokenChanges, []);
  assert.ok(result.limits.includes("unresolved-io"));
});

test("an explicit asset read failure suppresses shape and settlement", () => {
  const result = explainTransaction({
    confirmed: true,
    category: "token",
    inputCount: 1,
    outputCount: 1,
    assetsComplete: false,
    inputs: [{ boxId: "in", value: "10", address: A, assets: [] }],
    outputs: [{ boxId: "out", value: "10", address: B, assets: [] }],
  });

  assert.equal(result.coverage, "partial");
  assert.equal(result.shape, "unknown");
  assert.deepEqual(result.tokenChanges, []);
  assert.ok(result.limits.includes("unresolved-io"));
});

test("reports mint, burn, and changed quantities only for complete IO", () => {
  const result = explainTransaction({
    confirmed: true,
    inputCount: 2,
    outputCount: 1,
    inputs: [
      {
        boxId: "other",
        value: "1",
        address: A,
        assets: [
          { tokenId: "burn", amount: "10" },
          { tokenId: "move", amount: "10" },
        ],
      },
      {
        boxId: "mint",
        value: "1",
        address: A,
        assets: [],
      },
    ],
    outputs: [
      {
        boxId: "out",
        value: "1",
        address: B,
        assets: [
          { tokenId: "mint", amount: "20" },
          { tokenId: "move", amount: "7" },
        ],
      },
    ],
  });

  assert.deepEqual(
    result.tokenChanges.map(({ tokenId, kind }) => ({ tokenId, kind })),
    [
      { tokenId: "burn", kind: "burn" },
      { tokenId: "move", kind: "changed" },
      { tokenId: "mint", kind: "mint" },
    ]
  );
});

test("flags addresses present on both sides without calling them change", () => {
  const result = explainTransaction({
    confirmed: true,
    fee: "1000000",
    inputCount: 1,
    outputCount: 3,
    inputs: [{ boxId: "in", value: "1000000000", address: A, assets: [] }],
    outputs: [
      { boxId: "self", value: "499000000", address: A, assets: [] },
      { boxId: "paid", value: "500000000", address: B, assets: [] },
      { boxId: "fee", value: "1000000", address: MINERS_FEE_ADDRESS, assets: [] },
    ],
  });

  assert.equal(result.selfFlows.length, 1);
  assert.equal(result.selfFlows[0]?.address, A);
  assert.equal(result.selfFlows[0]?.kind, "sent");
  assert.equal(result.selfFlows[0]?.erg, -501000000n);
});

test("fee-collect explanation keeps the collected output and no paid fee", () => {
  const reward = `88${"a".repeat(50)}`;
  const result = explainTransaction({
    confirmed: true,
    source: "indexer",
    category: "fee-collect",
    shape: "fee-collect",
    fee: 0,
    inputCount: 2,
    outputCount: 1,
    inputs: [
      { boxId: "f1", value: "1500000", address: MINERS_FEE_ADDRESS, assets: [] },
      { boxId: "f2", value: "1100000", address: MINERS_FEE_ADDRESS, assets: [] },
    ],
    outputs: [{ boxId: "r", value: "2600000", address: reward, assets: [] }],
  });

  assert.equal(result.shape, "fee-collect");
  assert.equal(result.feeNano, 0n);
  assert.equal(result.nonFeeOutputNano, 2600000n);
  assert.equal(result.inputAddressCount, 0);
  assert.equal(result.outputAddressCount, 1);
});
