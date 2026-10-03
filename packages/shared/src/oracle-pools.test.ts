import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeSigmaLong, ERGUSD_PT, ERG_USD_ORACLE_NFT } from "./registers.js";
import {
  ORACLE_FEEDS,
  isOracleFeedSlug,
  oracleAgeBlocks,
  oracleEpochFromRegisters,
  oracleOperatorFromRegisters,
  oracleCurrentRound,
  oracleOperatorLive,
  oracleRoundKey,
  oracleSeatLive,
  oraclePostingLive,
  oracleQuoteFromR4,
  oracleQuoteFromRegisters,
  oracleWindowLeft,
  p2pkAddressFromCompressedPubkey,
  tokenAmountOnBox,
} from "./oracle-pools.js";

test("official, coop USD, and gold pools stay distinct", () => {
  assert.equal(isOracleFeedSlug("ergusd"), true);
  assert.equal(isOracleFeedSlug("eip-23"), false);
  assert.equal(ORACLE_FEEDS.ergusd.poolNft, ERG_USD_ORACLE_NFT);
  assert.equal(ORACLE_FEEDS.ergusd.oracleToken, ERGUSD_PT);
  assert.equal(ORACLE_FEEDS.ergusd.issued, 15);
  assert.equal(ORACLE_FEEDS.ergusd.epochLength, 6);
  assert.notEqual(ORACLE_FEEDS["erg-usd"].poolNft, ORACLE_FEEDS["xau-erg"].poolNft);
  assert.notEqual(ORACLE_FEEDS["erg-usd"].oracleToken, ORACLE_FEEDS["xau-erg"].oracleToken);
  assert.equal(ORACLE_FEEDS["erg-usd"].market, true);
  assert.equal(ORACLE_FEEDS["xau-erg"].market, true);
  assert.equal(ORACLE_FEEDS["erg-usd"].epochLength, 6);
  assert.equal(ORACLE_FEEDS["xau-erg"].epochLength, 30);
  assert.equal(ORACLE_FEEDS["erg-usd"].maxDeviationPercent, 5);
  assert.equal(ORACLE_FEEDS["xau-erg"].maxDeviationPercent, 5);
  assert.notEqual(ORACLE_FEEDS["erg-usd"].poolNft, ERG_USD_ORACLE_NFT);
});

test("age and refresh window from tip vs pool height", () => {
  assert.equal(oracleAgeBlocks(100, 94), 6);
  assert.equal(oracleAgeBlocks(94, 94), 0);
  assert.equal(oracleAgeBlocks(90, 94), 0);
  assert.equal(oracleAgeBlocks(null, 94), null);
  assert.equal(oracleWindowLeft(6, 2), 4);
  assert.equal(oracleWindowLeft(6, 6), 0);
  assert.equal(oracleWindowLeft(6, 10), 0);
  assert.equal(oracleWindowLeft(30, null), null);
  assert.equal(ORACLE_FEEDS["xau-erg"].market, true);
});

test("R4 nanoERG per unit → quote per ERG", () => {
  const q = oracleQuoteFromR4(4485028973n);
  assert.ok(q != null && q > 0.2 && q < 0.25);
});

test("quote and epoch from register map", () => {
  const hex = "05" + "c6a9c4e221";
  const r4 = decodeSigmaLong("05c6a9c4e221");
  assert.ok(r4 != null);
  const quote = oracleQuoteFromRegisters({ R4: { renderedValue: String(r4) } });
  assert.equal(quote, oracleQuoteFromR4(r4));
  assert.equal(oracleEpochFromRegisters({ R5: { renderedValue: "1875054" } }), 1_875_054);
  void hex;
});

test("datapoint R4 is the operator P2PK, not the pool script", () => {
  const regs = {
    R4: "07033e299a9add2321db9220fd34d41b75ce6a2dd0564fd6032205c39b32ef59da98",
    R5: "04cccb03",
    R6: "05a48ae4a01e",
  };
  const op = oracleOperatorFromRegisters(regs);
  assert.equal(op.address, "9gwBYpduqznLVRnDg5ksJrA3VodTvmt3jfuENMPahQHkjaZ1KBT");
  assert.equal(
    p2pkAddressFromCompressedPubkey(
      "033e299a9add2321db9220fd34d41b75ce6a2dd0564fd6032205c39b32ef59da98"
    ),
    op.address
  );
  assert.ok(op.quote != null && op.quote > 0);
  assert.equal(oracleOperatorFromRegisters({ R4: "05c6a9c4e221" }).address, null);
});

test("USD v1 round id is the shared 32 bytes, not a 6-block height window", () => {
  const round = "0e20" + "55".repeat(32);
  const older = "0e20" + "aa".repeat(32);
  assert.equal(oracleRoundKey(round), `h:${"55".repeat(32)}`);
  assert.equal(oracleRoundKey("049ed803")?.startsWith("n:"), true);
  const seats = [
    { round: oracleRoundKey(round), height: 1883450 },
    { round: oracleRoundKey(round), height: 1883457 },
    { round: oracleRoundKey(older), height: 849146 },
  ];
  const current = oracleCurrentRound(seats, 1_883_462);
  assert.equal(current, `h:${"55".repeat(32)}`);
  assert.equal(
    oracleSeatLive(seats[0]!.round, current, {
      opEpoch: null,
      poolEpoch: 1_883_462,
      opHeight: 1883450,
      poolHeight: 1883457,
      epochLength: 6,
    }),
    true
  );
  assert.equal(
    oracleSeatLive(seats[2]!.round, current, {
      opEpoch: null,
      poolEpoch: 1_883_462,
      opHeight: 849146,
      poolHeight: 1883457,
      epochLength: 6,
    }),
    false
  );
});

test("numeric pool epoch still marks only that epoch live", () => {
  const current = oracleCurrentRound(
    [
      { round: "n:30223", height: 1883457 },
      { round: "n:29409", height: 1875230 },
      { round: null, height: 1705795 },
    ],
    30223
  );
  assert.equal(current, "n:30223");
  assert.equal(
    oracleSeatLive("n:30223", current, {
      opEpoch: 30223,
      poolEpoch: 30223,
      opHeight: 1,
      poolHeight: 100,
      epochLength: 6,
    }),
    true
  );
  assert.equal(
    oracleSeatLive("n:29409", current, {
      opEpoch: 29409,
      poolEpoch: 30223,
      opHeight: 100,
      poolHeight: 100,
      epochLength: 6,
    }),
    false
  );
  assert.equal(
    oracleSeatLive(null, current, {
      opEpoch: null,
      poolEpoch: 30223,
      opHeight: 1883457,
      poolHeight: 1883457,
      epochLength: 6,
    }),
    false
  );
  assert.equal(
    oracleSeatLive("n:30222", current, {
      opEpoch: 30222,
      poolEpoch: 30223,
      opHeight: 1883457,
      poolHeight: 1883457,
      epochLength: 6,
    }),
    true
  );
  assert.equal(
    oracleSeatLive(null, current, {
      opEpoch: null,
      poolEpoch: 30223,
      opHeight: 1705795,
      poolHeight: 1883457,
      epochLength: 6,
    }),
    false
  );
});

test("live follows epoch, then the heartbeat height window", () => {
  assert.equal(
    oracleOperatorLive({
      opEpoch: 10,
      poolEpoch: 10,
      opHeight: 1,
      poolHeight: 100,
      epochLength: 6,
    }),
    true
  );
  assert.equal(
    oracleOperatorLive({
      opEpoch: 9,
      poolEpoch: 10,
      opHeight: 100,
      poolHeight: 100,
      epochLength: 6,
    }),
    false
  );
  assert.equal(
    oracleOperatorLive({
      opEpoch: null,
      poolEpoch: null,
      opHeight: 1875350,
      poolHeight: 1875319,
      epochLength: 30,
    }),
    true
  );
  assert.equal(
    oracleOperatorLive({
      opEpoch: null,
      poolEpoch: null,
      opHeight: 1872758,
      poolHeight: 1875319,
      epochLength: 30,
    }),
    false
  );
});

test("silent is an hour without a post", () => {
  const now = 1_700_000_000_000;
  assert.equal(
    oraclePostingLive({ tsMs: now - 30 * 60_000, nowMs: now, opHeight: 1, tipHeight: 100 }),
    true
  );
  assert.equal(
    oraclePostingLive({ tsMs: now - 61 * 60_000, nowMs: now, opHeight: 100, tipHeight: 100 }),
    false
  );
  assert.equal(
    oraclePostingLive({ tsMs: null, nowMs: now, opHeight: 90, tipHeight: 100 }),
    true
  );
  assert.equal(
    oraclePostingLive({ tsMs: null, nowMs: now, opHeight: 50, tipHeight: 100 }),
    false
  );
  assert.equal(
    oraclePostingLive({ tsMs: null, nowMs: now, opHeight: null, tipHeight: 100 }),
    false
  );
});

test("amount=1 is a live oracle box, stacks are not", () => {
  const id = ORACLE_FEEDS["erg-usd"].oracleToken;
  assert.equal(tokenAmountOnBox([{ tokenId: id, amount: "1" }], id), 1n);
  assert.equal(tokenAmountOnBox([{ tokenId: id, amount: "11" }], id), 11n);
});
