import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyTx,
  MINERS_FEE_ADDRESS,
  MINERS_FEE_TREE,
} from "@ergoscan/shared";
import {
  addressFromErgoTree,
  ergoTreeFromAddress,
  isErgoAddressChecksumValid,
  txWithTreeAddresses,
} from "./ergoAddress.js";

/** Live input from the mempool Unknown screenshot — P2PK. */
const P2PK =
  "9eh9WDsRAsujyFx4x7YeSoxrLCqmhuQihDwgsWVqEuXte7QJRCU";

test("miners-fee tree encodes to the known fee address", () => {
  assert.equal(addressFromErgoTree(MINERS_FEE_TREE), MINERS_FEE_ADDRESS);
  assert.equal(ergoTreeFromAddress(MINERS_FEE_ADDRESS), MINERS_FEE_TREE);
});

test("P2PK tree round-trips without the node", () => {
  assert.equal(isErgoAddressChecksumValid(P2PK), true);
  const tree = ergoTreeFromAddress(P2PK);
  assert.ok(tree && tree.startsWith("0008cd"));
  assert.equal(addressFromErgoTree(tree), P2PK);
});

test("missing tree is null", () => {
  assert.equal(addressFromErgoTree(null), null);
  assert.equal(addressFromErgoTree(""), null);
  assert.equal(addressFromErgoTree("zz"), null);
});

/** Emission lock from the home miners list. Prefix 88 is the v3 whitelist. */
const LOCK88 =
  "88dhgzEuTXaRQTX5KNdnaWTTX7fEZVEQRn6qP4MJotPuRnS3QpoJxYpSaXoU1y7SHp8ZXMp92TH22DBY";
const p2pkTree = `0008cd${"ab".repeat(33)}`;

test("emission tree encodes to an 88 address without the node", () => {
  const tree = ergoTreeFromAddress(LOCK88);
  assert.ok(tree && tree.length > 8);
  const addr = addressFromErgoTree(tree);
  assert.equal(addr, LOCK88);
  assert.ok(addr?.startsWith("88"));
});

test("txWithTreeAddresses fills fee and 88 from trees, keeps an existing address", () => {
  const lockTree = ergoTreeFromAddress(LOCK88);
  assert.ok(lockTree);
  const filled = txWithTreeAddresses({
    id: "m1",
    inputs: [{ ergoTree: lockTree }, { ergoTree: MINERS_FEE_TREE, address: "keep-me" }],
    outputs: [{ ergoTree: MINERS_FEE_TREE }],
  });
  assert.equal(filled.inputs?.[0]?.address, LOCK88);
  assert.equal(filled.inputs?.[1]?.address, "keep-me");
  assert.equal(filled.outputs?.[0]?.address, MINERS_FEE_ADDRESS);
});

test("mempool 88 spend is reward-unlock after encode, not Contract / script hash", () => {
  const lockTree = ergoTreeFromAddress(LOCK88);
  assert.ok(lockTree);
  const raw = {
    id: "m2",
    inputs: [{ ergoTree: lockTree }],
    outputs: [{ ergoTree: p2pkTree }, { ergoTree: MINERS_FEE_TREE }],
  };
  assert.equal(classifyTx(raw).category, "contract");

  const filled = txWithTreeAddresses(raw);
  assert.equal(classifyTx(filled).category, "reward-unlock");
});

test("malformed dump does not throw", () => {
  assert.doesNotThrow(() =>
    txWithTreeAddresses({
      id: "g",
      inputs: [{ ergoTree: "0008d3" }, { ergoTree: "zz" }],
      outputs: undefined,
    })
  );
});
