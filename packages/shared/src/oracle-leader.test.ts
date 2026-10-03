import assert from "node:assert/strict";
import { test } from "node:test";
import { ORACLE_FEEDS } from "./oracle-pools.js";
import { leaderAddressFromR4, pickLeader, type LeaderBox } from "./oracle-leader.js";

const USD = "9gmLjaHbzXeWEgQFuU9dyMgnBLCXRSuNBrfetw1tfc2THueZ7rW";
const GOLD = "9i8qQUyCHNnKbBMHamXmuRWcwfjmYZ3yt3vUH5Vbwh7Ur5xiPsD";
const OTHER = "9hj5oJbq4AfwJGfWRFKQ111111111111111111111111111111";

function box(partial: Partial<LeaderBox> & Pick<LeaderBox, "spent" | "value">): LeaderBox {
  return { address: null, seat: false, ...partial };
}

test("v1 has no refresh nft, v2 and gold do", () => {
  assert.equal(ORACLE_FEEDS.ergusd.refreshNft, undefined);
  assert.equal(ORACLE_FEEDS["erg-usd"].refreshNft?.length, 64);
  assert.equal(ORACLE_FEEDS["xau-erg"].refreshNft?.length, 64);
  assert.notEqual(ORACLE_FEEDS["erg-usd"].refreshNft, ORACLE_FEEDS["xau-erg"].refreshNft);
});

test("R4 of the live seats is the hot wallet", () => {
  assert.equal(
    leaderAddressFromR4("070327d0de042360309ab3cb6be07b30364d128a6ef93a71627c9d88e37e16e4231c"),
    USD
  );
  assert.equal(
    leaderAddressFromR4("0703dc514627b43918acc1226ce9b80b41723dec50238b27fc18b2d80b13ac8d3cb6"),
    GOLD
  );
});

test("seat that paid the fee is the leader", () => {
  const boxes: LeaderBox[] = [
    box({ spent: true, value: 11_500_000n, address: USD, seat: true }),
    box({ spent: false, value: 10_000_000n, address: USD, seat: true }),
    box({ spent: true, value: 10_000_000n, address: OTHER, seat: true }),
    box({ spent: false, value: 10_000_000n, address: OTHER, seat: true }),
  ];
  assert.equal(pickLeader(boxes), USD);
});

test("wallet pays when no seat lost value", () => {
  const boxes: LeaderBox[] = [
    box({ spent: true, value: 10_000_000n, address: USD, seat: true }),
    box({ spent: false, value: 10_000_000n, address: USD, seat: true }),
    box({ spent: true, value: 5_000_000_000n, address: GOLD, seat: false }),
    box({ spent: false, value: 4_998_500_000n, address: GOLD, seat: false }),
  ];
  assert.equal(pickLeader(boxes), GOLD);
});

test("a flat refresh has no leader", () => {
  assert.equal(
    pickLeader([
      box({ spent: true, value: 10_000_000n, address: USD, seat: true }),
      box({ spent: false, value: 10_000_000n, address: USD, seat: true }),
    ]),
    null
  );
});
