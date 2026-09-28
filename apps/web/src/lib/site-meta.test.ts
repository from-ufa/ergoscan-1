import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_OG_CAPTION,
  SITE_OG_HEADING,
  SITE_TAB_TITLE,
  SITE_TITLE,
  SITE_URL,
} from "./site-meta";

test("browser tab is the brand; share title names the chain", () => {
  assert.equal(SITE_TAB_TITLE, "ErgoScan");
  assert.notEqual(SITE_TAB_TITLE, SITE_TITLE);
  assert.match(SITE_TITLE, /Ergo \(ERG\) Blockchain Explorer/);
  assert.doesNotMatch(SITE_TITLE, /ErgoScan —/);
  assert.equal(SITE_NAME, "ergoscan.me");
  assert.equal(SITE_URL, "https://ergoscan.me");
});

test("share description lists chain surfaces without the word and", () => {
  assert.doesNotMatch(SITE_DESCRIPTION, /ErgoScan —/);
  assert.equal(SITE_DESCRIPTION.includes(SITE_TITLE), false);
  assert.doesNotMatch(SITE_DESCRIPTION, /\band\b/i);
  assert.match(SITE_DESCRIPTION, /^ErgoScan allows you to explore the Ergo blockchain/);
  for (const word of [
    "transactions",
    "addresses",
    "tokens",
    "contracts",
    "stablecoins",
    "mempool",
    "DEX",
    "protocol features",
    "eUTXO",
    "storage rent",
    "Ergo (ERG)",
  ]) {
    assert.match(SITE_DESCRIPTION, new RegExp(word.replace(/[()]/g, "\\$&")));
  }
  assert.ok(SITE_DESCRIPTION.length < 240);
});

test("og card heading is the network, caption is the product", () => {
  assert.equal(SITE_OG_HEADING, "Ergo Mainnet Explorer");
  assert.match(SITE_OG_CAPTION, /block explorer/);
});
