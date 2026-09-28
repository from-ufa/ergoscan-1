import assert from "node:assert/strict";
import test from "node:test";
import { claimsFromTx, decodeRentOutIndex, splitRentGap } from "./rentClaim.js";

test("extension 127 zigzag is the recreated output index", () => {
  assert.equal(decodeRentOutIndex("0300"), 0);
  assert.equal(decodeRentOutIndex("0302"), 1);
  assert.equal(decodeRentOutIndex("0304"), 2);
  assert.equal(decodeRentOutIndex("0306"), 3);
  assert.equal(decodeRentOutIndex("0308"), 4);
  assert.equal(decodeRentOutIndex("0301"), -1);
  assert.equal(decodeRentOutIndex(""), null);
  assert.equal(decodeRentOutIndex("04"), null);
});

test("empty proof and extension 127 is a claim; collector is the P2PK, not the miner", () => {
  const claims = claimsFromTx(
    {
      id: "aa",
      inputs: [
        {
          boxId: "box-a",
          address: "9owner",
          value: 186394887,
          spendingProof: { proofBytes: "", extension: { "127": "0300" } },
        },
        {
          boxId: "box-b",
          value: 1000,
          spendingProof: { proofBytes: "ab", extension: { "127": "0302" } },
        },
      ],
      outputs: [
        { value: 88894887, address: "9owner" },
        { value: 97500000, address: "9takerTakerTaker" },
        {
          value: 1,
          address:
            "2iHkR7CWvD1R4j1yZg5bkeDRQavjAaVPeTDFGGLZduHyfWMuYpmhHocX8GJoaieTx78FntzJbCBVL6rf96ocJoZdmWBL2fci7NqWgAirppPQmZ7fN9V6z13Ay6brPriBKYqLp1bT2Fk4FkFLCfdPpe",
        },
        { value: 9, address: "88minerRewardLock" },
      ],
    },
    1881776
  );
  assert.equal(claims.length, 1);
  assert.equal(claims[0]?.boxId, "box-a");
  assert.equal(claims[0]?.rentNano, String(186394887 - 88894887));
  assert.equal(claims[0]?.collector, "9takerTakerTaker");
  assert.equal(claims[0]?.outIndex, 0);
});

test("a box renewed back to its owner has no collector", () => {
  const claims = claimsFromTx(
    {
      id: "bb",
      inputs: [
        {
          boxId: "box-own",
          address: "9owner",
          value: 1_000_000_000,
          spendingProof: { proofBytes: "", extension: { "127": "0302" } },
        },
      ],
      outputs: [
        { value: 50_000_000, address: "2iHkR7CWvD1R4j1yZg5bkeDRQavjAaVPeTDFGGLZduHyfWMuYpmhHocX8GJoaieTx78FntzJbCBVL6rf96ocJoZdmWBL2fci7NqWgAirppPQmZ7fN9V6z13Ay6brPriBKYqLp1bT2Fk4FkFLCfdPpe" },
        { value: 950_000_000, address: "9owner" },
      ],
    },
    100
  );
  assert.equal(claims.length, 1);
  assert.equal(claims[0]?.collector, null);
  assert.equal(claims[0]?.rentNano, "50000000");
});

test("inputs that share one larger output split the fee gap, not the whole box", () => {
  const claims = claimsFromTx(
    {
      id: "cc",
      inputs: [
        {
          boxId: "box-1",
          address: "9ownerA",
          value: 100_000,
          spendingProof: { proofBytes: "", extension: { "127": "0300" } },
        },
        {
          boxId: "box-2",
          address: "9ownerB",
          value: 200_000,
          spendingProof: { proofBytes: "", extension: { "127": "0300" } },
        },
        {
          boxId: "box-3",
          address: "9ownerC",
          value: 700_000,
          spendingProof: { proofBytes: "", extension: { "127": "0300" } },
        },
      ],
      outputs: [
        { value: 900_000, address: "9collector" },
        {
          value: 100_000,
          address:
            "2iHkR7CWvD1R4j1yZg5bkeDRQavjAaVPeTDFGGLZduHyfWMuYpmhHocX8GJoaieTx78FntzJbCBVL6rf96ocJoZdmWBL2fci7NqWgAirppPQmZ7fN9V6z13Ay6brPriBKYqLp1bT2Fk4FkFLCfdPpe",
        },
      ],
    },
    1450179
  );
  assert.deepEqual(
    claims.map((row) => [row.boxId, row.rentNano, row.collector]),
    [
      ["box-1", "10000", "9collector"],
      ["box-2", "20000", "9collector"],
      ["box-3", "70000", "9collector"],
    ]
  );
  assert.equal(
    claims.reduce((sum, row) => sum + BigInt(row.rentNano), 0n),
    100_000n
  );
});

test("splitRentGap shares sum to the gap", () => {
  const shares = splitRentGap([1n, 1n, 1n], 2n);
  assert.equal(shares.reduce((s, n) => s + n, 0n), 2n);
  assert.deepEqual(shares, [1n, 1n, 0n]);
});
