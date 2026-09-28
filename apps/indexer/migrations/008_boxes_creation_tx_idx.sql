-- Address Activity: boxes created by a tx. Gateway SELECT, not the node.
CREATE INDEX CONCURRENTLY IF NOT EXISTS boxes_creation_tx_id_idx
  ON boxes (creation_tx_id)
  WHERE creation_tx_id IS NOT NULL;
