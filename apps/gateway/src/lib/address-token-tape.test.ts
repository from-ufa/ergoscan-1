import assert from "node:assert/strict";
import { test } from "node:test";
import { nftHeldByBalance, sortAddrTokenTape, type AddrTokenTapeRow } from "./addr-token-tape.js";

function row(partial: Partial<AddrTokenTapeRow> & { tokenId: string; amount: string }): AddrTokenTapeRow {
  return {
    amountUi: null,
    name: null,
    decimals: 0,
    emission: null,
    artworkUrl: null,
    priceUsd: null,
    valueUsd: null,
    firstHeight: null,
    lastHeight: null,
    firstTs: null,
    lastTs: null,
    ...partial,
  };
}

test("token tape sorts by USD value then amount", () => {
  const ranked = sortAddrTokenTape([
    row({ tokenId: "aa", amount: "9", amountUi: 9, valueUsd: null }),
    row({ tokenId: "bb", amount: "2", amountUi: 2, valueUsd: 50 }),
    row({ tokenId: "cc", amount: "3", amountUi: 3, valueUsd: 10 }),
  ]);
  assert.deepEqual(
    ranked.map((r) => r.tokenId),
    ["bb", "cc", "aa"]
  );
});

test("equal USD falls back to raw amount", () => {
  const ranked = sortAddrTokenTape([
    row({ tokenId: "aa", amount: "5", amountUi: null, valueUsd: null }),
    row({ tokenId: "bb", amount: "12", amountUi: null, valueUsd: null }),
  ]);
  assert.equal(ranked[0]?.tokenId, "bb");
});

test("nftHeldByBalance matches emission=1 and single unknown unit", () => {
  assert.equal(nftHeldByBalance(1, 0, "1"), true);
  assert.equal(nftHeldByBalance(1, 2, "100"), true);
  assert.equal(nftHeldByBalance(null, 0, "1"), true);
  assert.equal(nftHeldByBalance(0, 0, "1"), false);
  assert.equal(nftHeldByBalance(null, 0, "2"), false);
  assert.equal(nftHeldByBalance(null, 2, "1"), false);
});
