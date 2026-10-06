import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ADDR_TX_LAST_HEIGHT_SQL,
  UNSPENT_VALUE_INDEX,
  isHugeSummaryAddress,
} from "./addressSummary.js";
import { ADDRESS_SUMMARY_TX_BUMP_SET } from "./batchSql.js";

test("address_tx last is LIMIT 1, not MAX over the whole history", () => {
  assert.match(ADDR_TX_LAST_HEIGHT_SQL, /ORDER BY x\.height DESC/);
  assert.match(ADDR_TX_LAST_HEIGHT_SQL, /LIMIT 1/);
  assert.doesNotMatch(ADDR_TX_LAST_HEIGHT_SQL, /\bMAX\s*\(/i);
  assert.doesNotMatch(ADDR_TX_LAST_HEIGHT_SQL, /JOIN packed\.address_tx/);
  assert.match(ADDR_TX_LAST_HEIGHT_SQL, /x\.addr_id = \(SELECT ad\.id FROM packed\.addr ad/);
});

test("fat ERG sums use the packed unspent index", () => {
  assert.equal(UNSPENT_VALUE_INDEX.schema, "packed");
  assert.equal(UNSPENT_VALUE_INDEX.name, "packed_boxes_unspent_addr_value_idx");
});

test("a P2S longer than 2000 chars is stored by hash, not skipped", () => {
  assert.equal(isHugeSummaryAddress("a".repeat(2000)), false);
  assert.equal(isHugeSummaryAddress("a".repeat(2001)), true);
  assert.equal(isHugeSummaryAddress("a".repeat(3287)), true);
});

test("address_tx bump GREATEST/LEAST heights with tx_count", () => {
  assert.match(ADDRESS_SUMMARY_TX_BUMP_SET, /tx_count = address_summary\.tx_count \+ EXCLUDED\.tx_count/);
  assert.match(ADDRESS_SUMMARY_TX_BUMP_SET, /GREATEST\(address_summary\.last_height/);
  assert.match(ADDRESS_SUMMARY_TX_BUMP_SET, /LEAST\(address_summary\.first_height/);
});
