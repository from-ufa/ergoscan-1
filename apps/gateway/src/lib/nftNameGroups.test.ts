import assert from "node:assert/strict";
import { test } from "node:test";
import { groupNftNameCollections, nftCollectionFromName } from "./indexDb.js";

test("nftCollectionFromName strips #n / -n / edition n", () => {
  assert.equal(nftCollectionFromName("Wolves #12", "aa").collection, "Wolves");
  assert.equal(nftCollectionFromName("Wolves-12", "aa").collection, "Wolves");
  assert.equal(nftCollectionFromName("Wolves edition 3", "aa").collection, "Wolves");
  assert.equal(nftCollectionFromName("Wolves #12", "aa").slug, "wolves");
});

test("groupNftNameCollections keeps series with count >= 2", () => {
  const g = groupNftNameCollections(
    [
      { tokenId: "aa", name: "Wolves #1", artworkUrl: "https://x/1.png", height: 10 },
      { tokenId: "bb", name: "Wolves #2", artworkUrl: null, height: 11 },
      { tokenId: "cc", name: "Solo Piece", artworkUrl: null, height: 12 },
    ],
    10
  );
  assert.equal(g.length, 1);
  assert.equal(g[0]!.name, "Wolves");
  assert.equal(g[0]!.count, 2);
  assert.equal(g[0]!.coverUrl, "https://x/1.png");
  assert.equal(g[0]!.slug, "wolves");
});
