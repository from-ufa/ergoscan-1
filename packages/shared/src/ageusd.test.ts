import assert from "node:assert/strict";
import { test } from "node:test";
import { SIGMAUSD_BANK_ADDRESS } from "./lock-addresses.js";
import {
  AGEUSD_BANK_V2_NFT,
  AGEUSD_RC_MAX_RAW,
  AGEUSD_SC_MAX_RAW,
  SIGRSV_TOKEN_ID,
  SIGUSD_TOKEN_ID,
  isAgeUsdBankAddress,
  isAgeUsdBankNft,
  snapshotAgeUsd,
  snapshotAgeUsdFromOracle,
  sqlNotAgeUsdBankPool,
  withoutAgeUsdBankNfts,
} from "./ageusd.js";

test("AgeUSD token ids are hex64 and not the bank NFT", () => {
  assert.match(SIGUSD_TOKEN_ID, /^[0-9a-f]{64}$/);
  assert.match(SIGRSV_TOKEN_ID, /^[0-9a-f]{64}$/);
  assert.equal(isAgeUsdBankNft(SIGUSD_TOKEN_ID), false);
});

test("v2 bank NFT is denylisted, Spectrum LP is not", () => {
  assert.equal(isAgeUsdBankNft(AGEUSD_BANK_V2_NFT), true);
  assert.equal(isAgeUsdBankNft(AGEUSD_BANK_V2_NFT.toUpperCase()), true);
  assert.equal(
    isAgeUsdBankNft(
      "9916d75132593c8b07fe18bd8d583bda1652eed7565cf41a4738ddd90fc992ec"
    ),
    false
  );
  assert.equal(isAgeUsdBankNft(""), false);
});

test("bank address helper matches consts.js lock", () => {
  assert.equal(isAgeUsdBankAddress(SIGMAUSD_BANK_ADDRESS), true);
  assert.equal(isAgeUsdBankAddress("9" + "x".repeat(51)), false);
});

test("withoutAgeUsdBankNfts drops only the bank", () => {
  const lp = "9916d75132593c8b07fe18bd8d583bda1652eed7565cf41a4738ddd90fc992ec";
  assert.deepEqual(withoutAgeUsdBankNfts([AGEUSD_BANK_V2_NFT, lp]), [lp]);
});

test("sql fragment rejects odd column names", () => {
  assert.match(sqlNotAgeUsdBankPool("t.pool_id"), /NOT IN/);
  assert.throws(() => sqlNotAgeUsdBankPool("pool_id; drop"));
});

test("reserve ratio and gates follow the 400–800 band", () => {
  const mid = snapshotAgeUsd({
    reserveNano: 1_600_000e9,
    sigUsdInBank: AGEUSD_SC_MAX_RAW - 16_000_000,
    sigRsvInBank: AGEUSD_RC_MAX_RAW - 1_000_000,
    ergUsd: 0.4,
  });
  assert.ok(mid.reserveRatio != null && mid.reserveRatio > 390 && mid.reserveRatio < 410);
  assert.equal(mid.band, "in");
  assert.equal(mid.mintUsd, true);
  assert.equal(mid.redeemUsd, true);
  assert.equal(mid.mintRsv, true);
  assert.equal(mid.redeemRsv, true);
  assert.equal(mid.sigUsdUsd, 1);
  assert.ok(mid.sigUsdErg != null && Math.abs(mid.sigUsdErg - 2.5) < 1e-9);

  const low = snapshotAgeUsd({
    reserveNano: 1_600_000e9,
    sigUsdInBank: AGEUSD_SC_MAX_RAW - 16_000_000,
    sigRsvInBank: AGEUSD_RC_MAX_RAW - 1_000_000,
    ergUsd: 0.2,
  });
  assert.equal(low.band, "below");
  assert.equal(low.mintUsd, false);
  assert.equal(low.redeemUsd, true);
  assert.equal(low.mintRsv, true);
  assert.equal(low.redeemRsv, false);
});

test("oracle RR matches EIP-15 integer rate", () => {
  const snap = snapshotAgeUsdFromOracle({
    reserveNano: 1_622_791_573_979_132,
    scCircRaw: 15_989_920,
    rcCircRaw: 5_428_814_483,
    nanoPerUsd: 4_002_975_790,
  });
  assert.ok(snap.reserveRatio != null && snap.reserveRatio > 250 && snap.reserveRatio < 256);
  assert.equal(snap.band, "below");
  assert.ok(snap.sigUsdErg != null && Math.abs(snap.sigUsdErg - 4.00297579) < 1e-6);
});
