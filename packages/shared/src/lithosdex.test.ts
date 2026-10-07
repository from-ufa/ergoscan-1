import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LIT_TOKEN_ID_MAINNET,
  LITHOS_AUDITOR_ADDRESS,
  LITHOS_COLLAT_ADDRESS,
  LITHOS_COLLAT_TOKEN_ID,
  LITHOS_INVESTOR_ADDRESS,
  LITHOS_TEAM_ADDRESS,
  classifyLithosFind,
  lenderAddressFromCollateralR5,
  LITHOS_LOCKED_LP,
  LITHOS_POOL_NFT_PLACEHOLDER,
  classifyLithosBoxDelta,
  classifyLithosFill,
  classifyLithosSwap,
  isLithosPlaceholderId,
  isLitTokenId,
  lithosEnabledFromEnv,
  lithosNanoToErg,
  lithosPoolNftFromEnv,
  lithosPoolSnapFromBox,
  lithosPendingFromRegs,
  lithosRawToDecimal,
  lithosTokenYFromEnv,
  pickLithosCounterparty,
  pickLithosPoolAssets,
  pickLithosPoolShape,
} from "./lithosdex.js";

const nft = "aa".repeat(32);
const prov = "bb".repeat(32);

test("placeholders are not live ids", () => {
  assert.equal(isLithosPlaceholderId(LITHOS_POOL_NFT_PLACEHOLDER), true);
  assert.equal(isLithosPlaceholderId("2".repeat(64)), true);
  assert.equal(isLithosPlaceholderId("3".repeat(64)), true);
  assert.equal(isLithosPlaceholderId("0".repeat(64)), true);
  assert.equal(isLithosPlaceholderId(nft), false);
  assert.equal(isLitTokenId(LIT_TOKEN_ID_MAINNET), true);
  assert.equal(LITHOS_COLLAT_TOKEN_ID, "a8a790e784e93ac0e68649181ae3d251e84fb5c741624100e7e945ae1e82dc98");
  assert.equal(LITHOS_COLLAT_ADDRESS.startsWith("foqgf3Ys6E6JCr9"), true);
  assert.equal(LITHOS_COLLAT_ADDRESS.length > 200, true);
});

test("a Lithos find splits lender, finder, holding, and the three private pays", () => {
  const r5 = "08cd026ffaac3de9f082b6cbf06831c585423befffad5e2b8aec4943cf74f7791095c8";
  const lender = lenderAddressFromCollateralR5(r5);
  assert.equal(lender, "9fNNsbZafWkEGCmWNwcsRkY1s6cUJyQhuR23t7CLnsVgCJuZxs8");
  const holding = "W" + "v".repeat(80);
  const parts = classifyLithosFind(r5, [
    { address: lender!, litRaw: "2140000000000" },
    { address: holding, litRaw: "480000000000" },
    { address: LITHOS_TEAM_ADDRESS, litRaw: "100000000000" },
    { address: LITHOS_INVESTOR_ADDRESS, litRaw: "25000000000" },
    { address: LITHOS_AUDITOR_ADDRESS, litRaw: "15000000000" },
    { address: "9gmzNhfCHe" + "a".repeat(40), litRaw: "20000000000" },
  ]);
  assert.equal(parts?.finderLit, "20000000000");
  assert.equal(parts?.permitLit, "2140000000000");
  assert.equal(parts?.holdingLit, "480000000000");
  assert.equal(parts?.teamLit, "100000000000");
  assert.equal(parts?.lenderAddress, lender);
  assert.equal(classifyLithosFind(r5, [
    { address: lender!, litRaw: "1" },
    { address: holding, litRaw: "1" },
    { address: "9a" + "b".repeat(49), litRaw: "1" },
    { address: "9c" + "d".repeat(49), litRaw: "1" },
  ]), null);
});

test("env pool NFT rejects placeholders and junk", () => {
  assert.equal(lithosPoolNftFromEnv(""), null);
  assert.equal(lithosPoolNftFromEnv(LITHOS_POOL_NFT_PLACEHOLDER), null);
  assert.equal(lithosPoolNftFromEnv("not-hex"), null);
  assert.equal(lithosPoolNftFromEnv(nft), nft);
  assert.equal(lithosTokenYFromEnv(""), LIT_TOKEN_ID_MAINNET);
  assert.equal(lithosEnabledFromEnv(undefined), true);
  assert.equal(lithosEnabledFromEnv("0"), false);
});

test("pool assets: NFT + LIT + provision, not token order", () => {
  const parts = pickLithosPoolAssets([
    { tokenId: LIT_TOKEN_ID_MAINNET, amount: 9_000_000 },
    { tokenId: prov, amount: 999_999_000_000 },
    { tokenId: nft, amount: 1, emission: 1 },
  ]);
  assert.deepEqual(parts, { nft, lit: LIT_TOKEN_ID_MAINNET, prov });
});

test("pool assets keep a 1e18 LIT row (above MAX_SAFE_INTEGER)", () => {
  const litRaw = "1000000000000000000";
  const parts = pickLithosPoolAssets([
    { tokenId: LIT_TOKEN_ID_MAINNET, amount: litRaw },
    { tokenId: prov, amount: "999999000000" },
    { tokenId: nft, amount: "1", emission: 1 },
  ]);
  assert.deepEqual(parts, { nft, lit: LIT_TOKEN_ID_MAINNET, prov });
  assert.equal(lithosRawToDecimal(BigInt(litRaw), 9), 1_000_000_000);
});

test("non-LIT pool quote is the reserve, not the locked shares", () => {
  const quote = "cc".repeat(32);
  const parts = pickLithosPoolShape([
    { tokenId: nft, amount: 1, emission: 1 },
    { tokenId: quote, amount: 100_000_000, emission: 1e18 },
    { tokenId: prov, amount: 1e15, emission: 1e15 },
  ]);
  assert.deepEqual(parts, { nft, lit: quote, prov });
});

test("LIT box shape stays the LIT picker", () => {
  const assets = [
    { tokenId: LIT_TOKEN_ID_MAINNET, amount: 9_000_000, emission: 1e18 },
    { tokenId: prov, amount: 999_999_000_000, emission: 1e15 },
    { tokenId: nft, amount: 1, emission: 1 },
  ];
  assert.deepEqual(pickLithosPoolShape(assets), pickLithosPoolAssets(assets));
});

test("Spectrum-shaped 3-asset without LIT is not Lithos", () => {
  assert.equal(
    pickLithosPoolAssets([
      { tokenId: nft, amount: 1, emission: 1 },
      { tokenId: "cc".repeat(32), amount: 50 },
      { tokenId: prov, amount: 1e12 },
    ]),
    null
  );
});

test("placeholder NFT is not a pool", () => {
  assert.equal(
    pickLithosPoolAssets([
      { tokenId: LITHOS_POOL_NFT_PLACEHOLDER, amount: 1, emission: 1 },
      { tokenId: LIT_TOKEN_ID_MAINNET, amount: 9_000_000 },
      { tokenId: prov, amount: 1e12 },
    ]),
    null
  );
});

test("classifySwap: ERG in, LIT out, fee to pendingX", () => {
  const prev = {
    reservesX: 1_000_000_000n,
    reservesY: 50_000n,
    pendingX: 10n,
    pendingY: 0n,
    supply: 1_000n,
  };
  const next = {
    reservesX: 1_100_000_000n,
    reservesY: 45_000n,
    pendingX: 25n,
    pendingY: 0n,
    supply: 1_000n,
  };
  const s = classifyLithosSwap(prev, next);
  assert.ok(s);
  assert.equal(s.ergIn, true);
  assert.equal(s.amountIn, 100_000_000n + 15n);
  assert.equal(s.amountOut, 5_000n);
});

test("classifySwap skips deposit (supply moved)", () => {
  const prev = {
    reservesX: 1_000n,
    reservesY: 1_000n,
    pendingX: 0n,
    pendingY: 0n,
    supply: 10n,
  };
  const next = {
    reservesX: 2_000n,
    reservesY: 2_000n,
    pendingX: 0n,
    pendingY: 0n,
    supply: 20n,
  };
  assert.equal(classifyLithosSwap(prev, next), null);
});

test("R6 Coll[Long] is pendingX / pendingY", () => {
  const fromList = lithosPendingFromRegs({ R6: "[100, 7]" });
  assert.deepEqual(fromList, { pendingX: 100n, pendingY: 7n });
  assert.deepEqual(lithosPendingFromRegs({ R6: "0c05020000" }), {
    pendingX: 0n,
    pendingY: 0n,
  });
  assert.equal(lithosPendingFromRegs({ R4: "05aa" }), null);
  assert.equal(lithosPendingFromRegs({ R6: "[1]" }), null);
  assert.equal(lithosPendingFromRegs({ R6: "[-1, 0]" }), null);
});

test("snap from box subtracts pending and reads R4 supply", () => {
  const remaining = 100n;
  const snap = lithosPoolSnapFromBox(11_000_000_000n, 50_015n, {
    R4: remaining,
    R6: "[1000000000, 15]",
  });
  assert.ok(snap);
  assert.equal(snap.reservesX, 10_000_000_000n);
  assert.equal(snap.reservesY, 50_000n);
  assert.equal(snap.pendingX, 1_000_000_000n);
  assert.equal(snap.pendingY, 15n);
  assert.equal(snap.supply, LITHOS_LOCKED_LP - remaining);
});

test("snap without R4 is not a register classify", () => {
  assert.equal(lithosPoolSnapFromBox(1e9, 50, { R6: "[0, 0]" }), null);
});

test("classifyFill prefers reserves when both boxes have R4", () => {
  const remaining = 50n;
  const hit = classifyLithosFill(
    {
      valueNano: 1_000_000_010n,
      litRaw: 50_000n,
      regs: { R4: remaining, R6: "[10, 0]" },
    },
    {
      valueNano: 1_100_000_025n,
      litRaw: 45_000n,
      regs: { R4: remaining, R6: "[25, 0]" },
    },
    0
  );
  assert.ok(hit);
  assert.equal(hit.ergIn, true);
  assert.equal(hit.amountIn, 100_000_000n + 15n);
  assert.equal(hit.amountOut, 5_000n);
});

test("classifyFill falls back to box delta when R4 is missing", () => {
  const hit = classifyLithosFill(
    { valueNano: 1e9, litRaw: 200, regs: { R6: "[0, 0]" } },
    { valueNano: 2e9, litRaw: 100, regs: { R6: "[0, 0]" } },
    0
  );
  assert.ok(hit);
  assert.equal(hit.ergIn, true);
  assert.equal(hit.amountIn, 1_000_000_000n);
  assert.equal(hit.amountOut, 100n);
});

test("classifyFill skips provision move even without R4", () => {
  assert.equal(
    classifyLithosFill(
      { valueNano: 1e9, litRaw: 200, regs: {} },
      { valueNano: 2e9, litRaw: 100, regs: {} },
      4
    ),
    null
  );
});

test("box delta: provision move is not a swap", () => {
  assert.equal(classifyLithosBoxDelta(1e9, -100, -1), null);
  assert.equal(classifyLithosBoxDelta(1e9, 100, 0), null);
  const buy = classifyLithosBoxDelta(1e9, -100, 0);
  assert.deepEqual(buy, { ergIn: true, amountIn: 1_000_000_000n, amountOut: 100n });
  const sell = classifyLithosBoxDelta(-1e9, 100, 0);
  assert.deepEqual(sell, { ergIn: false, amountIn: 100n, amountOut: 1_000_000_000n });
});

test("nano → ERG stays exact past 9 million ERG", () => {
  assert.equal(lithosNanoToErg(10_000_000_000_000_000n), 10_000_000);
});

test("trader is the P2PK who received the out asset, not the miner", () => {
  const trader = "9fQywDVhS8aXNtGHx8ACgzJmpH7r6fT7v8u9w0x1y2z3A4B5C6D";
  const miner = "9iMinerChangeAddrxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
  assert.equal(trader.length >= 50 && miner.length >= 50, true);
  const buy = pickLithosCounterparty({
    poolOutBox: "pool-out",
    ergIn: true,
    amountOut: 5_000n,
    outputs: [
      { boxId: "pool-out", address: "contract", valueNano: 2e9, litRaw: 45_000 },
      { boxId: "miner", address: miner, valueNano: 50e9, litRaw: 0 },
      { boxId: "taker", address: trader, valueNano: 1e6, litRaw: 5_000 },
    ],
  });
  assert.equal(buy, trader);

  const sell = pickLithosCounterparty({
    poolOutBox: "pool-out",
    ergIn: false,
    amountOut: 2_000_000_000n,
    outputs: [
      { boxId: "pool-out", address: "contract", valueNano: 8e9, litRaw: 60_000 },
      { boxId: "miner", address: miner, valueNano: 80e9, litRaw: 0 },
      { boxId: "taker", address: trader, valueNano: 2e9, litRaw: 0 },
    ],
  });
  assert.equal(sell, trader);
});

test("trader stays empty when only miner change is in range", () => {
  const miner = "9iMinerChangeAddrxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
  assert.equal(
    pickLithosCounterparty({
      poolOutBox: "pool-out",
      ergIn: false,
      amountOut: 2_000_000_000n,
      outputs: [
        { boxId: "miner", address: miner, valueNano: 80e9, litRaw: 0 },
      ],
    }),
    null
  );
});
