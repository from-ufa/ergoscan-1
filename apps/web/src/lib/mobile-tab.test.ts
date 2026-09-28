import assert from "node:assert/strict";
import { test } from "node:test";
import { MOBILE_TABS, moreActive, pathActive } from "./mobile-tab";

test("phone tabs are home / mempool / txs / tokens", () => {
  assert.deepEqual(
    MOBILE_TABS.map((t) => t.href),
    ["/", "/mempool", "/transactions", "/tokens"]
  );
});

test("pathActive matches the same trees as the rail", () => {
  const home = MOBILE_TABS[0];
  const mempool = MOBILE_TABS[1];
  const txs = MOBILE_TABS[2];
  const tokens = MOBILE_TABS[3];

  assert.equal(pathActive("/", home), true);
  assert.equal(pathActive("/mempool", home), false);
  assert.equal(pathActive("/mempool", mempool), true);
  assert.equal(pathActive("/tx/abc", txs), true);
  assert.equal(pathActive("/transactions", txs), true);
  assert.equal(pathActive("/token/aa", tokens), true);
  assert.equal(pathActive("/tokens", tokens), true);
  assert.equal(pathActive("/nfts", tokens), false);
});

test("More is active off the four tab trees", () => {
  assert.equal(moreActive("/"), false);
  assert.equal(moreActive("/tx/dead"), false);
  assert.equal(moreActive("/nfts"), true);
  assert.equal(moreActive("/rent"), true);
  assert.equal(moreActive("/address/9abc"), true);
  assert.equal(moreActive("/status"), true);
});
