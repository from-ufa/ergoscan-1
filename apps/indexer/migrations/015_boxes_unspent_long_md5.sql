-- Long P2S (emission, reemission, mixers) are excluded from boxes_unspent_idx:
-- a full btree on address breaks on huge script keys. Writer-only md5 lookup
-- so address_summary can recount them without a seq scan of boxes.
CREATE INDEX CONCURRENTLY IF NOT EXISTS boxes_unspent_long_md5_idx
  ON boxes (md5(address))
  WHERE spent_tx_id IS NULL AND address IS NOT NULL AND length(address) > 200;
