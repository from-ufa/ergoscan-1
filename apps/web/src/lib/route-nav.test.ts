import assert from "node:assert/strict";
import { test } from "node:test";
import { locKey, navArrived, navTargetOf, isHomeLoc } from "./route-nav";

const ORIGIN = "https://ergoscan.me";

test("hash tab on the same page is not a navigation", () => {
  assert.equal(navTargetOf("#tokens", ORIGIN, "/address/abc", ""), null);
  assert.equal(navTargetOf("/address/abc#tokens", ORIGIN, "/address/abc", ""), null);
});

test("same path with only a hash change is not a navigation", () => {
  assert.equal(navTargetOf("/tx/deadbeef#boxes", ORIGIN, "/tx/deadbeef", ""), null);
});

test("internal path change is a navigation", () => {
  assert.equal(
    navTargetOf("/address/b", ORIGIN, "/address/a", ""),
    "/address/b"
  );
  assert.equal(navTargetOf("/blocks", ORIGIN, "/", ""), "/blocks");
  assert.equal(navTargetOf("/", ORIGIN, "/blocks", ""), "/");
  assert.equal(navTargetOf("/favorites", ORIGIN, "/blocks", ""), "/favorites");
});

test("search query is a real navigation", () => {
  assert.equal(
    navTargetOf("/search?q=9foo", ORIGIN, "/blocks", ""),
    "/search?q=9foo"
  );
});

test("defi token filter is a query navigation", () => {
  assert.equal(
    navTargetOf("/defi", ORIGIN, "/defi", "tokenId=aa"),
    "/defi"
  );
  assert.equal(navTargetOf("/defi?tokenId=aa", ORIGIN, "/defi", ""), "/defi?tokenId=aa");
});

test("external and special hrefs are ignored", () => {
  assert.equal(navTargetOf("https://example.com/x", ORIGIN, "/", ""), null);
  assert.equal(navTargetOf("mailto:a@b.c", ORIGIN, "/", ""), null);
  assert.equal(navTargetOf("", ORIGIN, "/", ""), null);
});

test("trailing slash matches the live path", () => {
  assert.equal(navTargetOf("/blocks/", ORIGIN, "/", ""), "/blocks");
  assert.equal(locKey("/blocks/", ""), "/blocks");
});

test("search redirect completes on the entity page", () => {
  assert.equal(
    navArrived("/address/9foo", "/search?q=9foo", "/blocks"),
    true
  );
  assert.equal(navArrived("/blocks", "/search?q=9foo", "/blocks"), false);
  assert.equal(
    navArrived("/search?q=9foo", "/search?q=9foo", "/blocks"),
    true
  );
});

test("rapid hops wait for the latest target, not the first neighbor", () => {
  assert.equal(navArrived("/block/101", "/block/102", "/block/100"), false);
  assert.equal(navArrived("/block/102", "/block/102", "/block/100"), true);
});

test("home is a first-class nav target", () => {
  assert.equal(isHomeLoc("/"), true);
  assert.equal(isHomeLoc("/?preview=share"), true);
  assert.equal(isHomeLoc("/blocks"), false);
  assert.equal(navArrived("/", "/", "/blocks"), true);
});
