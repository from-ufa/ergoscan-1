import assert from "node:assert/strict";
import { test } from "node:test";
import { orderByHolderRank } from "./token-hit-rank";

const USE = "a55b8735ed1a99e46c2c89f8994aacdf4b1109bdcf682f1e5b34479c6e392669";
const TEST = "548a6819b987023f413beb3320deafe16f8d81ca4836aebed94bae9098a69201";
const OLD = "89b6715e7e5819cb7c1eb418f4bc35cdcc8ab459214d12b25958f4200037940a";

test("same-name tokens follow holder rank, not token id", () => {
  const hits = [
    { type: "token", id: TEST },
    { type: "token", id: OLD },
    { type: "token", id: USE },
  ];
  const ranked = orderByHolderRank(hits, [USE, TEST, OLD]);
  assert.deepEqual(
    ranked.map((h) => h.id),
    [USE, TEST, OLD]
  );
});

test("non-token hits keep their slots", () => {
  const hits = [
    { type: "address", id: "9addr" },
    { type: "token", id: TEST },
    { type: "token", id: USE },
  ];
  const ranked = orderByHolderRank(hits, [USE, TEST]);
  assert.equal(ranked[0]?.id, "9addr");
  assert.equal(ranked[1]?.id, USE);
  assert.equal(ranked[2]?.id, TEST);
});
