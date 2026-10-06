import assert from "node:assert/strict";
import test from "node:test";
import { blockHeaderFromRow, votesFromHex } from "./blockHeader.js";

test("votes hex is three protocol bytes", () => {
  assert.deepEqual(votesFromHex("000000"), [0, 0, 0]);
  assert.deepEqual(votesFromHex("780000"), [120, 0, 0]);
  assert.deepEqual(votesFromHex(null), []);
});

test("header is absent until the state root is stored", () => {
  assert.equal(blockHeaderFromRow({ difficulty: "9" }), null);
  const h = blockHeaderFromRow({
    version: 4,
    nBits: "117499053",
    votes: "000000",
    difficulty: "251431680475136",
    stateRoot: "ab".repeat(32),
    adProofsRoot: "cd".repeat(32),
    transactionsRoot: "ef".repeat(32),
    extensionHash: "01".repeat(32),
    powPk: "02".repeat(33).toUpperCase(),
    powW: "03".repeat(33),
    powN: "0102030405060708",
    powD: "0",
  });
  assert.ok(h);
  assert.equal(h.version, 4);
  assert.equal(h.nBits, "117499053");
  assert.deepEqual(h.votes, [0, 0, 0]);
  assert.equal(h.powPk, "02".repeat(33));
  assert.equal(h.powD, "0");
  assert.equal(h.stateRoot.length, 64);
});
