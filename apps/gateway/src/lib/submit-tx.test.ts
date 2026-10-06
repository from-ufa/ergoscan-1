import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isSubmitTxQuery,
  publicSubmitFail,
  resetGraphqlReadLimiterForTests,
  resetSubmitLimiterForTests,
  takeGraphqlReadSlot,
  takeSubmitSlot,
  validateSignedTx,
} from "./submit-tx.js";

const TREE = "0008cd03" + "ab".repeat(32);
const BOX = "a".repeat(64);
const TOKEN = "b".repeat(64);
const PROOF = "c".repeat(64);

function signed(over: Record<string, unknown> = {}) {
  return {
    id: "d".repeat(64),
    inputs: [
      {
        boxId: BOX,
        spendingProof: { proofBytes: PROOF, extension: {} },
        ergoTree: TREE,
        value: 1_000_000,
      },
    ],
    dataInputs: [],
    outputs: [
      {
        value: 1_000_000,
        ergoTree: TREE,
        creationHeight: 100,
        assets: [{ tokenId: TOKEN, amount: "2" }],
        additionalRegisters: {},
      },
    ],
    ...over,
  };
}

test("accepts a Fleet/Nautilus signed tx and extra input fields", () => {
  assert.equal(validateSignedTx(signed()).ok, true);
  assert.equal(
    validateSignedTx({
      inputs: [{ boxId: BOX, spendingProof: { proofBytes: "" } }],
      outputs: [{ value: "1000", ergoTree: TREE, creationHeight: 1 }],
    }).ok,
    true
  );
});

test("rejects junk before the node would see it", () => {
  assert.equal(validateSignedTx(null).ok, false);
  assert.equal(validateSignedTx([]).ok, false);
  assert.equal(validateSignedTx({ foo: 1 }).ok, false);
  assert.equal(validateSignedTx({ inputs: [], outputs: signed().outputs }).ok, false);
  assert.equal(
    validateSignedTx({
      inputs: [{ boxId: BOX }],
      outputs: signed().outputs,
    }).ok,
    false
  );
  assert.equal(
    validateSignedTx({
      inputs: signed().inputs,
      outputs: [{ value: 1, ergoTree: TREE }],
    }).ok,
    false
  );
});

test("submit limiter counts REST and GraphQL against one IP", () => {
  resetSubmitLimiterForTests();
  const a = takeSubmitSlot("1.1.1.1", 2, 2);
  const b = takeSubmitSlot("1.1.1.1", 2, 2);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  const c = takeSubmitSlot("1.1.1.1", 2, 2);
  assert.equal(c.ok, false);
  if (a.ok) a.release();
  if (b.ok) b.release();
  const d = takeSubmitSlot("1.1.1.1", 2, 2);
  assert.equal(d.ok, false);
  const inflight = takeSubmitSlot("2.2.2.2", 10, 1);
  assert.equal(inflight.ok, true);
  const blocked = takeSubmitSlot("2.2.2.2", 10, 1);
  assert.equal(blocked.ok, false);
  if (blocked.ok === false) assert.equal(blocked.reason, "inflight");
  if (inflight.ok) inflight.release();
  assert.equal(isSubmitTxQuery("mutation { submitTx(signedJson: $s) { id } }"), true);
});

test("graphql reads have their own minute budget", () => {
  resetGraphqlReadLimiterForTests();
  resetSubmitLimiterForTests();
  assert.equal(takeGraphqlReadSlot("9.9.9.9", 2).ok, true);
  assert.equal(takeGraphqlReadSlot("9.9.9.9", 2).ok, true);
  const blocked = takeGraphqlReadSlot("9.9.9.9", 2);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.ok(blocked.retryAfterSec >= 1);
  assert.equal(takeSubmitSlot("9.9.9.9", 1, 1).ok, true);
});

test("client submit errors are stable codes, not node text", () => {
  const raw =
    'Error: node 400 POST /transactions {\n  "error" : 400,\n  "reason" : "bad.request",\n  "detail" : "Malformed transaction: Every input"\n}';
  const p = publicSubmitFail(raw);
  assert.equal(p.error, "rejected");
  assert.equal(p.status, 400);
  assert.equal(JSON.stringify(p).includes("Malformed"), false);
  assert.equal(JSON.stringify(p).includes("/transactions"), false);
  const down = publicSubmitFail(new Error("TimeoutError"));
  assert.equal(down.error, "submit_failed");
  assert.equal(down.status, 502);
});
