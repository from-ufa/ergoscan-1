-- Address Activity: boxes spent by a tx. Gateway SELECT, not the node.
CREATE INDEX CONCURRENTLY IF NOT EXISTS boxes_spent_tx_id_idx
  ON boxes (spent_tx_id)
  WHERE spent_tx_id IS NOT NULL;
