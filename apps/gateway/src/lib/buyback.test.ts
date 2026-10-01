import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assembleBuyback,
  buybackBySlug,
  epochPay,
  goldCover,
  moveKind,
  type RawBox,
} from "./buyback.js";

function box(partial: Partial<RawBox> & Pick<RawBox, "id" | "height" | "erg" | "reward">): RawBox {
  return {
    nft: 1n,
    spentHeight: null,
    spentTx: null,
    creationTx: "birth",
    ...partial,
  };
}

test("buyback slugs are the two live pools", () => {
  assert.equal(buybackBySlug("xau-erg")?.symbol, "GORT");
  assert.equal(buybackBySlug("erg-usd")?.symbol, "DORT");
  assert.equal(buybackBySlug("ergusd"), null);
});

test("move kind follows the box delta", () => {
  assert.equal(moveKind(-10n, 4n), "swap");
  assert.equal(moveKind(10n, 0n), "topup");
  assert.equal(moveKind(0n, -4n), "return");
  assert.equal(moveKind(9n, 1n), "open");
});

test("assemble chains top-up, swap, and return", () => {
  const rows: RawBox[] = [
    box({
      id: "a",
      height: 10,
      erg: 1000n,
      reward: 1n,
      creationTx: "c0",
      spentHeight: 20,
      spentTx: "t1",
    }),
    box({
      id: "b",
      height: 20,
      erg: 1500n,
      reward: 1n,
      creationTx: "t1",
      spentHeight: 30,
      spentTx: "t2",
    }),
    box({
      id: "c",
      height: 30,
      erg: 1000n,
      reward: 5n,
      creationTx: "t2",
      spentHeight: 40,
      spentTx: "t3",
    }),
    box({
      id: "d",
      height: 40,
      erg: 1000n,
      reward: 1n,
      creationTx: "t3",
    }),
    box({ id: "spare", height: 15, nft: 2n, erg: 1n, reward: 0n, creationTx: "s" }),
  ];
  const got = assembleBuyback(rows);
  assert.equal(got.live?.id, "d");
  assert.equal(got.spare, 2n);
  assert.deepEqual(
    got.moves.map((m) => m.kind),
    ["topup", "swap", "return"]
  );
  assert.equal(got.moves[1]?.dtok, 4n);
  assert.equal(got.moves[2]?.token, 1n);
});

test("epoch pay is 2×(N−1)", () => {
  assert.equal(epochPay(9), 16);
  assert.equal(epochPay(11), 20);
  assert.equal(epochPay(1), null);
});

test("gold cover stays shut below 800%", () => {
  const cover = goldCover(4_760_456_285_314n, 9_999_999_972_184n, 398_708_652_848_018n);
  assert.ok(cover);
  assert.equal(cover.payoutOpen, false);
  assert.ok(cover.ratioBps > 4200 && cover.ratioBps < 4400);
});
