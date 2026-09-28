import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ADDR_FLOW_RULES_VERSION,
  asAddrFlowKind,
  classifyAddrFlow,
  eip4MintOfOutputs,
} from "./addr-flow.js";

const ERG = 1_000_000_000n;
const FEE = 1_100_000n;

test("rules version", () => {
  assert.equal(ADDR_FLOW_RULES_VERSION, 2);
});

test("send with change is sent, not intra", () => {
  const kind = classifyAddrFlow({
    netErg: -(10n * ERG + FEE),
    fee: FEE,
  });
  assert.equal(kind, "sent");
});

test("receive is received", () => {
  assert.equal(classifyAddrFlow({ netErg: 5n * ERG, fee: FEE }), "received");
});

test("consolidation / self-pay is intra when net is exactly −fee", () => {
  assert.equal(classifyAddrFlow({ netErg: -FEE, fee: FEE }), "intra");
});

test("net zero is intra", () => {
  assert.equal(classifyAddrFlow({ netErg: 0n, fee: FEE }), "intra");
});

test("both-sides presence is not the rule", () => {
  // Old code: hasIn && hasOut → intra. A normal send always has both.
  assert.notEqual(
    classifyAddrFlow({ netErg: -(ERG + FEE), fee: FEE }),
    "intra"
  );
});

test("token send covering fee only is sent", () => {
  assert.equal(
    classifyAddrFlow({
      netErg: -FEE,
      fee: FEE,
      tokens: [{ amount: -50n }],
    }),
    "sent"
  );
});

test("lost ERG gained token follows ERG — sent, not a DEX swap label", () => {
  assert.equal(
    classifyAddrFlow({
      netErg: -(2n * ERG + FEE),
      fee: FEE,
      tokens: [{ amount: 100n }],
    }),
    "sent"
  );
});

test("ERG in and token out is received (fill-shaped)", () => {
  assert.equal(
    classifyAddrFlow({
      netErg: 3n * ERG,
      fee: FEE,
      tokens: [{ amount: -40n }],
    }),
    "received"
  );
});

test("Spectrum-shaped order: lock tokens, pay fee, is sent", () => {
  assert.equal(
    classifyAddrFlow({
      netErg: -FEE,
      fee: FEE,
      tokens: [{ amount: -250n }],
    }),
    "sent"
  );
});

test("Spectrum-shaped fill: only the bought asset arrives, is received", () => {
  assert.equal(
    classifyAddrFlow({
      netErg: 0n,
      fee: FEE,
      tokens: [{ amount: 250n }],
    }),
    "received"
  );
});

test("mint to self while paying fee is intra, not received", () => {
  assert.equal(
    classifyAddrFlow({
      netErg: -FEE,
      fee: FEE,
      tokens: [{ amount: 1_000n, mint: 1_000n }],
    }),
    "intra"
  );
});

test("EIP-4 mint box id equals token id", () => {
  const boxId = "ab".repeat(32);
  const mint = eip4MintOfOutputs([
    { boxId, assets: [{ tokenId: boxId, amount: "40" }] },
  ]);
  assert.equal(mint.get(boxId), 40n);
});

test("unknown kind is null", () => {
  assert.equal(asAddrFlowKind("in"), null);
  assert.equal(asAddrFlowKind("swap"), null);
});
