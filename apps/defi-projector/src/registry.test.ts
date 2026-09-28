import assert from "node:assert/strict";
import { test } from "node:test";
import { AGEUSD_BANK_V2_NFT } from "@ergoscan/shared";
import { nftsForDetect, registryForWindow, type PoolReg } from "./registry.js";

function nft(id: string, existedFrom: number | null): PoolReg {
  return {
    poolId: id,
    quoteToken: "a".repeat(64),
    symbol: null,
    decimals: 0,
    existedFrom,
  };
}

test("window keeps NFTs that already existed and those with unknown height", () => {
  const regs = [nft("old", 452_140), nft("now", 775_999), nft("future", 1_200_000), nft("unk", null)];
  const live = registryForWindow(regs, 775_999);
  assert.deepEqual(
    live.map((r) => r.poolId),
    ["old", "now", "unk"]
  );
});

test("nftsForDetect intersects live list with spent-in-window ids", () => {
  assert.deepEqual(nftsForDetect(["a", "b", "c"], ["c", "a"]), ["a", "c"]);
  assert.deepEqual(nftsForDetect(["a", "b"], []), []);
  assert.deepEqual(nftsForDetect(["a", "b"], null), ["a", "b"]);
});

test("AgeUSD bank NFT can sit in a window list but detect must drop it separately", () => {
  const bank = nft(AGEUSD_BANK_V2_NFT, 452_140);
  const live = registryForWindow([bank], 500_000);
  assert.equal(live.length, 1);
  assert.equal(live[0]?.poolId, AGEUSD_BANK_V2_NFT);
});

test("early history window is a handful, not the full registry", () => {
  const regs = [nft("a", 452_140), nft("b", 500_000), nft("c", 1_800_000)];
  assert.equal(registryForWindow(regs, 452_000).length, 0);
  assert.equal(registryForWindow(regs, 452_140).length, 1);
  assert.equal(registryForWindow(regs, 1_870_000).length, 3);
});
