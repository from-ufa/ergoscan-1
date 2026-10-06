import assert from "node:assert/strict";
import { test } from "node:test";
import { headerBytesFromNode, hexBuf } from "./headerBackfill.js";

test("hexBuf keeps even hex and drops junk", () => {
  assert.equal(hexBuf("0x0a0b")?.toString("hex"), "0a0b");
  assert.equal(hexBuf("abc"), null);
  assert.equal(hexBuf(""), null);
});

test("header bytes are the signing fields", () => {
  const b = headerBytesFromNode({
    version: 4,
    nBits: 104644003,
    votes: "000000",
    stateRoot: "ab".repeat(32),
    adProofsRoot: "cd".repeat(32),
    transactionsRoot: "ef".repeat(32),
    extensionHash: "01".repeat(32),
    powSolutions: { w: "02".repeat(33), n: "0102030405060708", d: 0 },
  });
  assert.equal(b.version, 4);
  assert.equal(b.nBits, "104644003");
  assert.equal(b.votes?.toString("hex"), "000000");
  assert.equal(b.stateRoot?.length, 32);
  assert.equal(b.powW?.length, 33);
  assert.equal(b.powN?.length, 8);
  assert.equal(b.powD, "0");
});

test("votes may be a byte list", () => {
  const b = headerBytesFromNode({ votes: [0, 1, 2] });
  assert.equal(b.votes?.toString("hex"), "000102");
});
