-- After 023 is indisvalid and EXPLAIN SUM on a whale is Index Only Scan
-- boxes_unspent_value_idx. Not applied by npm run migrate (not in migrations/).
-- One CONCURRENTLY. Do not run in the same window as 023 CREATE.
DROP INDEX CONCURRENTLY IF EXISTS boxes_unspent_idx;
