-- Covering (address) INCLUDE (value_nano) so SUM(value_nano) is Index Only,
-- same as COUNT on boxes_unspent_idx. Predicate byte-for-byte as 002.
-- Lab and indexer boot do not CREATE this (15GB, tip lag, INVALID on restart).
-- VPS: npm run migrate -w @ergoscan/indexer in an IO window.
-- While this idx is missing or INVALID, deferAddressSummaries skips
-- box_count >= 4000. Do not lift skip in code until pg_index.indisvalid.
-- Planner may still pick the old boxes_unspent_idx until it is dropped.
-- After EXPLAIN SUM on a whale is Index Only Scan here: apply
-- apps/indexer/sql/024_drop_boxes_unspent_idx.sql (not this migrate).
CREATE INDEX CONCURRENTLY IF NOT EXISTS boxes_unspent_value_idx
  ON boxes (address) INCLUDE (value_nano)
  WHERE spent_tx_id IS NULL AND address IS NOT NULL AND length(address) <= 200;
