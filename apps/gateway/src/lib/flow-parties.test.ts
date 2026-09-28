import assert from "node:assert/strict";
import { test } from "node:test";
import { MINERS_FEE_ADDRESS } from "@ergoscan/shared";
import {
  FLOW_PARTY_CAP,
  flowParties,
  netTokenParties,
  zipTokenLegs,
} from "./flow-parties.js";

test("flowParties lists unique from/to and drops miners fee on to", () => {
  const got = flowParties(
    [{ address: "9fromA" }, { address: "9fromA" }, { address: "9fromB" }],
    [{ address: "9toA" }, { address: MINERS_FEE_ADDRESS }, { address: "9toB" }]
  );
  assert.deepEqual(got.from, ["9fromA", "9fromB"]);
  assert.deepEqual(got.to, ["9toA", "9toB"]);
});

test("flowParties caps counterparties", () => {
  const many = Array.from({ length: FLOW_PARTY_CAP + 3 }, (_, i) => ({
    address: `9addr${i}`,
  }));
  const got = flowParties(many, many);
  assert.equal(got.from.length, FLOW_PARTY_CAP);
  assert.equal(got.to.length, FLOW_PARTY_CAP);
});

test("netTokenParties: change + pay is A→B, not A→A", () => {
  const got = netTokenParties(
    [{ address: "9A", amount: 100n }],
    [
      { address: "9A", amount: 40n },
      { address: "9B", amount: 60n },
    ]
  );
  assert.deepEqual(got.from, ["9A"]);
  assert.deepEqual(got.to, ["9B"]);
  assert.equal(got.moved, "60");
});

test("netTokenParties: exact self-shuffle is not a move", () => {
  const got = netTokenParties(
    [{ address: "9A", amount: 69420n }],
    [{ address: "9A", amount: 69420n }]
  );
  assert.deepEqual(got.from, []);
  assert.deepEqual(got.to, []);
  assert.equal(got.moved, "0");
});

test("netTokenParties: mint has empty from", () => {
  const got = netTokenParties([], [{ address: "9A", amount: 1000n }]);
  assert.deepEqual(got.from, []);
  assert.deepEqual(got.to, ["9A"]);
  assert.equal(got.moved, "1000");
});

test("netTokenParties drops miners fee on to", () => {
  const got = netTokenParties(
    [{ address: "9A", amount: 5n }],
    [{ address: MINERS_FEE_ADDRESS, amount: 5n }]
  );
  assert.deepEqual(got.from, ["9A"]);
  assert.deepEqual(got.to, []);
});

test("zipTokenLegs pairs parallel aggs", () => {
  const legs = zipTokenLegs(["9A", "9B"], ["10", "20"]);
  assert.deepEqual(legs, [
    { address: "9A", amount: 10n },
    { address: "9B", amount: 20n },
  ]);
});
