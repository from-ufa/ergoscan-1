-- Spent+unspent long P2S. boxes_unspent_long_md5_idx is unspent only.
-- address_tx catch-up and GET must not seq-scan boxes.address (btree ≤200).
CREATE INDEX CONCURRENTLY IF NOT EXISTS boxes_long_md5_idx
  ON boxes (md5(address))
  WHERE address IS NOT NULL AND length(address) > 200;
