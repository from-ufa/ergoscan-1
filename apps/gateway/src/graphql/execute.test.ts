import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parse } from "graphql";
import { GRAPHQL_SDL, GRAPHQL_MAX_DEPTH } from "./schema.js";
import { documentDepth, depthError } from "./depth.js";
import { graphqlSchema, parseGraphqlBody, runGraphql } from "./execute.js";
import type { GraphqlCtx } from "./resolvers.js";
import type { RawTx } from "@ergoscan/shared";

const ctx: GraphqlCtx = {
  getRawMempool: () => new Map([["tx1", { id: "tx1", size: 120 } as RawTx]]),
  getFullHeight: () => 1,
  submitTx: async () => "deadbeef",
  network: "mainnet",
};

describe("graphql", () => {
  it("schema builds and has no ErgoTree / unbounded boxes root", () => {
    const s = graphqlSchema();
    const q = s.getQueryType();
    const m = s.getMutationType();
    assert.ok(q && m);
    const fields = Object.keys(q.getFields());
    assert.ok(fields.includes("boxesByGix"));
    assert.ok(fields.includes("oracles"));
    assert.ok(fields.includes("defi"));
    assert.ok(Object.keys(m.getFields()).includes("submitTx"));
    assert.equal(fields.includes("boxes"), false);
    assert.equal(/ergoTreeTemplateHash/.test(GRAPHQL_SDL), false);
    assert.equal(/boxes\(spent/.test(GRAPHQL_SDL), false);
  });

  it("rejects a missing query and a huge body", () => {
    assert.deepEqual(parseGraphqlBody({}), { error: "query required" });
    assert.equal("error" in parseGraphqlBody(null), true);
    assert.equal("error" in parseGraphqlBody({ query: "q".repeat(20_000) }), true);
    const ok = parseGraphqlBody({ query: "{ state { height } }", variables: { a: 1 } });
    assert.equal("error" in ok, false);
    if (!("error" in ok)) assert.equal(ok.variables?.a, 1);
  });

  it("caps selection depth", () => {
    const deep = parse(`query { a { b { c { d { e { f { g { h } } } } } } } }`);
    assert.ok(documentDepth(deep) > GRAPHQL_MAX_DEPTH);
    assert.ok(depthError(documentDepth(deep)));
    const ok = parse(`query { address(id: "9x") { unspent { items { assets { tokenId } } } } }`);
    assert.equal(depthError(documentDepth(ok)), null);
  });

  it("validates gix window before I/O", async () => {
    const result = await runGraphql(
      `query { boxesByGix(minGix: "0", maxGix: "10000") { boxId } }`,
      undefined,
      undefined,
      ctx
    );
    const msg = result.errors?.[0]?.message ?? "";
    assert.match(msg, /window too large|gix stream query exceeded/);
  });

  it("rejects nautls-style boxes(spent) at validate", async () => {
    const result = await runGraphql(
      `query { boxes(spent: false) { boxId } }`,
      undefined,
      undefined,
      ctx
    );
    assert.match(result.errors?.[0]?.message ?? "", /Cannot query field "boxes"/);
  });

  it("reads mempool from RAM and rejects bad submit JSON", async () => {
    const mp = await runGraphql(`query { mempool { size transactions { id size } } }`, undefined, undefined, ctx);
    assert.equal(mp.errors, undefined);
    const data = mp.data as { mempool: { size: number; transactions: { id: string }[] } };
    assert.equal(data.mempool.size, 1);
    assert.equal(data.mempool.transactions[0]?.id, "tx1");

    const bad = await runGraphql(
      `mutation { submitTx(signedJson: "not-json") { id error } }`,
      undefined,
      undefined,
      ctx
    );
    const sub = bad.data as { submitTx: { id: string | null; error: string } };
    assert.equal(sub.submitTx.id, null);
    assert.match(sub.submitTx.error, /signedJson/);
    const junk = await runGraphql(
      `mutation { submitTx(signedJson: "{\\"foo\\":1}") { id error } }`,
      undefined,
      undefined,
      ctx
    );
    const j = junk.data as { submitTx: { id: string | null; error: string } };
    assert.equal(j.submitTx.id, null);
    assert.match(j.submitTx.error, /inputs/);

    const leakCtx: GraphqlCtx = {
      ...ctx,
      submitTx: async () => {
        throw new Error(
          'node 400 POST /transactions { "reason" : "bad.request", "detail" : "Malformed transaction" }'
        );
      },
    };
    const TREE = "0008cd03" + "ab".repeat(32);
    const signed = JSON.stringify({
      inputs: [{ boxId: "a".repeat(64), spendingProof: { proofBytes: "cc".repeat(32) } }],
      outputs: [{ value: 1, ergoTree: TREE, creationHeight: 1 }],
    });
    const leaked = await runGraphql(
      `mutation($s: String!) { submitTx(signedJson: $s) { id error } }`,
      { s: signed },
      undefined,
      leakCtx
    );
    const L = leaked.data as { submitTx: { id: string | null; error: string } };
    assert.equal(L.submitTx.id, null);
    assert.equal(L.submitTx.error, "rejected");
    assert.equal(JSON.stringify(leaked).includes("Malformed"), false);
    assert.equal(JSON.stringify(leaked).includes("/transactions"), false);
  });
});
