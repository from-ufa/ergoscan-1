import assert from "node:assert/strict";
import test from "node:test";
import { inputProofsFromBlock, spendingProofHex } from "./inputProofBackfill.js";

const BOX = "ab".repeat(32);

test("empty and odd proofs stay null", () => {
  assert.equal(spendingProofHex(""), null);
  assert.equal(spendingProofHex("abc"), null);
  assert.equal(spendingProofHex("zz"), null);
  assert.equal(spendingProofHex("0a0b"), "0a0b");
});

test("the transactions section is read the same way as a full block", () => {
  const proofs = inputProofsFromBlock({
    headerId: "ff".repeat(32),
    transactions: [{ inputs: [{ boxId: BOX, spendingProof: { proofBytes: "abcd" } }] }],
  });
  assert.deepEqual(proofs, [{ boxId: BOX, proof: "abcd" }]);
});

test("a block keeps only non-empty input proofs", () => {
  const proofs = inputProofsFromBlock({
    blockTransactions: {
      transactions: [
        {
          inputs: [
            { boxId: BOX, spendingProof: { proofBytes: "aa" } },
            { boxId: "cd".repeat(32), spendingProof: { proofBytes: "" } },
          ],
        },
      ],
    },
  });
  assert.deepEqual(proofs, [{ boxId: BOX, proof: "aa" }]);
});
