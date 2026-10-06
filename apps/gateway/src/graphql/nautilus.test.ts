import assert from "node:assert/strict";
import test from "node:test";
import { parse, validate } from "graphql";
import { isSubmitTxQuery } from "../lib/submit-tx.js";
import { headerFromRow, nautilusRoot, nautilusSchema, runNautilus, votesFromHex, type NautilusCtx } from "./nautilus.js";

const ctx: NautilusCtx = {
  getRawMempool: () => new Map(),
  getFullHeight: () => 10,
  submitTx: async () => "abc",
  checkTx: async () => "abc",
  network: "mainnet",
};

test("votes are three protocol bytes", () => {
  assert.deepEqual(votesFromHex("000000"), [0, 0, 0]);
  assert.deepEqual(votesFromHex("780000"), [120, 0, 0]);
});

test("a stored header keeps signing fields as strings", () => {
  const header = headerFromRow({
    id: "ab".repeat(32),
    parent: "cd".repeat(32),
    version: 4,
    height: 12,
    n_bits: "117499053",
    difficulty: "251431680475136",
    ts: "1700000000000",
    state_root: "aa".repeat(32),
    ad: "bb".repeat(32),
    txr: "cc".repeat(32),
    ext: "dd".repeat(32),
    miner_pk: "02".repeat(33),
    w: "03".repeat(33),
    n: "0102030405060708",
    d: "0",
    votes: "000000",
  });
  assert.equal(header.nBits, "117499053");
  assert.equal(header.difficulty, "251431680475136");
  assert.equal(header.timestamp, "1700000000000");
  assert.deepEqual(header.votes, [0, 0, 0]);
  assert.equal((header.powSolutions as { d: number }).d, 0);
});

test("Nautilus documents validate against the wallet schema", () => {
  const schema = nautilusSchema();
  const docs = [
    "query info { info { version } state { network } }",
    "query currentHeight { blockHeaders(take: 1) { height } }",
    `query blockHeaders($take: Int) {
      blockHeaders(take: $take) {
        headerId timestamp version adProofsRoot stateRoot transactionsRoot
        nBits extensionHash powSolutions height difficulty parentId votes
      }
    }`,
    `query addresses($addresses: [String!]!) {
      addresses(addresses: $addresses) { address used balance { nanoErgs assets { amount tokenId } } }
    }`,
    `query oldBoxesCheck($maxHeight: Int, $addresses: [String!]) {
      boxes(maxHeight: $maxHeight, addresses: $addresses, heightType: creation, spent: false, take: 1) { creationHeight }
    }`,
    `query Tokens($tokenIds: [String!]) {
      tokens(tokenIds: $tokenIds) {
        tokenId type emissionAmount name description decimals boxId
        box { transactionId additionalRegisters }
      }
    }`,
    `query mempoolTxCheck($transactionIds: [String!]) {
      mempool { transactions(transactionIds: $transactionIds) { transactionId } }
    }`,
    `query boxes($spent: Boolean!, $ergoTrees: [String!], $skip: Int, $take: Int) {
      boxes(spent: $spent, ergoTrees: $ergoTrees, skip: $skip, take: $take) {
        boxId transactionId index value creationHeight ergoTree
        assets { tokenId amount }
        additionalRegisters
        beingSpent
      }
    }`,
    `query confirmedTransactions($addresses: [String!], $skip: Int, $take: Int, $onlyRelevantOutputs: Boolean) {
      transactions(addresses: $addresses, skip: $skip, take: $take) {
        transactionId timestamp inclusionHeight headerId index
        inputs { proofBytes extension index box { boxId value } }
        dataInputs { boxId }
        outputs(relevantOnly: $onlyRelevantOutputs) { boxId value }
      }
    }`,
    `mutation submitTransaction($signedTransaction: SignedTransaction!) {
      submitTransaction(signedTransaction: $signedTransaction)
    }`,
    `mutation checkTransaction($signedTransaction: SignedTransaction!) {
      checkTransaction(signedTransaction: $signedTransaction)
    }`,
  ];
  for (const source of docs) {
    const errors = validate(schema, parse(source));
    assert.deepEqual(errors.map((error) => error.message), [], source.slice(0, 40));
  }
});

test("info version is the Nautilus minimum and boxes need a filter", async () => {
  const info = await runNautilus("query { info { version } }", undefined, undefined, ctx, async () => {
    throw new Error("no sql");
  });
  assert.equal(info.data?.info?.version, "0.5.5");
  let called = false;
  const root = nautilusRoot(async () => {
    called = true;
    return [];
  });
  const boxes = await root.boxes({ spent: false, take: 10 }, ctx);
  assert.deepEqual(boxes, []);
  assert.equal(called, false);
});

test("submit mutations share the submit limiter name", () => {
  assert.equal(isSubmitTxQuery("mutation { submitTransaction(signedTransaction: $s) }"), true);
  assert.equal(isSubmitTxQuery("mutation { checkTransaction(signedTransaction: $s) }"), true);
  assert.equal(isSubmitTxQuery("query { info { version } }"), false);
});
