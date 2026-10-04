import assert from "node:assert/strict";
import { test } from "node:test";
import { MOBILE_TABS, moreActive, pathActive } from "./mobile-tab";

test("phone tabs are home / blocks / mempool / txs", () => {
  assert.deepEqual(
    MOBILE_TABS.map((t) => t.href),
    ["/", "/blocks", "/mempool", "/transactions"]
  );
});

test("pathActive matches the same trees as the rail", () => {
  const home = MOBILE_TABS[0];
  const blocks = MOBILE_TABS[1];
  const mempool = MOBILE_TABS[2];
  const txs = MOBILE_TABS[3];

  assert.equal(pathActive("/", home), true);
  assert.equal(pathActive("/mempool", home), false);
  assert.equal(pathActive("/blocks", blocks), true);
  assert.equal(pathActive("/block/abc", blocks), true);
  assert.equal(pathActive("/mempool", mempool), true);
  assert.equal(pathActive("/tx/abc", txs), true);
  assert.equal(pathActive("/transactions", txs), true);
  assert.equal(pathActive("/tokens", txs), false);
});

test("More is active off the four tab trees", () => {
  assert.equal(moreActive("/"), false);
  assert.equal(moreActive("/block/abc"), false);
  assert.equal(moreActive("/tx/dead"), false);
  assert.equal(moreActive("/tokens"), true);
  assert.equal(moreActive("/nfts"), true);
  assert.equal(moreActive("/rent"), true);
  assert.equal(moreActive("/address/9abc"), true);
  assert.equal(moreActive("/status"), true);
});
