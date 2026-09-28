-- Token tx tape: keyset (token_id, height DESC, tx_id). Apply CONCURRENTLY, not inside indexer catchup BEGIN.
CREATE INDEX CONCURRENTLY IF NOT EXISTS token_tx_seen_height_idx
  ON token_tx_seen (token_id, height DESC NULLS LAST, tx_id DESC);
