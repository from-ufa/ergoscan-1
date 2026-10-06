import assert from "node:assert/strict";
import test from "node:test";
import { parseBlockCard, parseBlockHeader } from "./list-snapshots.js";

test("a block card without a header stays a transaction page", () => {
  const card = parseBlockCard({
    id: "ab".repeat(32),
    height: 10,
    timestamp: 1,
    size: 100,
    txCount: 1,
  });
  assert.ok(card);
  assert.equal(card.header, null);
});

test("header bytes survive the card parse", () => {
  const header = parseBlockHeader({
    version: 4,
    nBits: "117499053",
    votes: [120, 0, 0],
    difficulty: "251431680475136",
    stateRoot: "ab".repeat(32),
    adProofsRoot: "cd".repeat(32),
    transactionsRoot: "ef".repeat(32),
    extensionHash: "01".repeat(32),
    powPk: "02".repeat(33),
    powW: "03".repeat(33),
    powN: "0102030405060708",
    powD: "0",
  });
  assert.ok(header);
  assert.equal(header.version, 4);
  assert.deepEqual(header.votes, [120, 0, 0]);
  assert.equal(header.powD, "0");
  assert.equal(parseBlockHeader({ votes: [1, 2, 3] }), null);
  assert.equal(parseBlockHeader({ stateRoot: "abc", votes: [1] }), null);
});
