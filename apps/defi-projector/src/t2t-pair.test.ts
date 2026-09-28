import assert from "node:assert/strict";
import { test } from "node:test";
import { AGEUSD_BANK_V2_NFT } from "@ergoscan/shared";
import { isT2tSwapDelta, pickT2tPair } from "./t2t-pair.js";

const nft = "080e453271ff4d2f85f97569b09755e67537bf2a1bc1cd09411b459cf901b902";
const lp = "ef8b8067973e3f96e3b39d54a9b53039414986392b1861ed572db67ac96f7f60";
const sigusd = "03faf2cb329f2e90d6d23b58d91bbb6c046aa143261cc21f52fbe2824bfcbf04";
const sigrsv = "003bd19d0187117f130b62e1bcab0939929ff5c7709f843c5c4dd158949285d0";

test("SigUSD/SigRSV pool: LP is same name, pair is lex-ordered", () => {
  const p = pickT2tPair(
    [
      { tokenId: nft, amount: 1, name: "SigUSD_SigRSV_LP" },
      { tokenId: lp, amount: 9e18, name: "SigUSD_SigRSV_LP" },
      { tokenId: sigusd, amount: 4797, name: "SigUSD" },
      { tokenId: sigrsv, amount: 1_538_314, name: "SigRSV" },
    ],
    nft
  );
  assert.ok(p);
  assert.equal(p.lp, lp);
  assert.equal(p.tokenA, sigrsv);
  assert.equal(p.tokenB, sigusd);
});

test("AgeUSD bank (3 assets) is not a T2T pool", () => {
  assert.equal(
    pickT2tPair(
      [
        { tokenId: AGEUSD_BANK_V2_NFT, amount: 1, name: "SUSD Bank V2 NFT" },
        { tokenId: sigusd, amount: 1e10, name: "SigUSD" },
        { tokenId: sigrsv, amount: 1e10, name: "SigRSV" },
      ],
      AGEUSD_BANK_V2_NFT
    ),
    null
  );
});

test("swap vs add: opposite token deltas and unchanged LP", () => {
  assert.equal(isT2tSwapDelta(-100, 50, 0), true);
  assert.equal(isT2tSwapDelta(100, -50, 0), true);
  assert.equal(isT2tSwapDelta(-100, -50, 0), false);
  assert.equal(isT2tSwapDelta(-100, 50, 10), false);
  assert.equal(isT2tSwapDelta(0, 50, 0), false);
});
