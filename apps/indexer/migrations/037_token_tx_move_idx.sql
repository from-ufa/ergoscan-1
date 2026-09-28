CREATE INDEX CONCURRENTLY IF NOT EXISTS token_tx_move_height_idx
  ON token_tx_move (token_id, height DESC NULLS LAST, tx_id DESC);
