import assert from "node:assert/strict";
import test from "node:test";
import { emptyFavorites, normalizeFavorites } from "./favorites";

test("an older address list stays addresses", () => {
  const store = normalizeFavorites({ addresses: ["9abc", "", 3, "9def"] });
  assert.deepEqual(store.addresses, ["9abc", "9def"]);
  assert.deepEqual(store.tokens, []);
  assert.deepEqual(store.pools, []);
});

test("each kind keeps its own ids", () => {
  const store = normalizeFavorites({
    addresses: ["9a"],
    tokens: ["aa"],
    blocks: ["bb"],
    transactions: ["cc"],
    pools: ["dd"],
  });
  assert.deepEqual(store, {
    ...emptyFavorites(),
    addresses: ["9a"],
    tokens: ["aa"],
    blocks: ["bb"],
    transactions: ["cc"],
    pools: ["dd"],
  });
});

test("junk storage is an empty book", () => {
  assert.deepEqual(normalizeFavorites(null), emptyFavorites());
  assert.deepEqual(normalizeFavorites("nope"), emptyFavorites());
});
