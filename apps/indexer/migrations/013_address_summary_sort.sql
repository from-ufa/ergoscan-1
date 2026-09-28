-- Sort keys for GET /v1/page/addresses. Writer = indexer boot / migrate.
-- User GET is SELECT ... ORDER BY these indexes LIMIT/OFFSET — no COUNT/SUM boxes.

CREATE INDEX IF NOT EXISTS address_summary_token_count_idx
  ON address_summary (token_count DESC, address);

CREATE INDEX IF NOT EXISTS address_summary_tx_count_idx
  ON address_summary (tx_count DESC, address);
