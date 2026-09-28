-- Nullable gix. No DEFAULT — do not rewrite boxes/transactions.
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS gix BIGINT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS gix BIGINT;

INSERT INTO indexer_state (key, value) VALUES
  ('box_gix_next', '0'),
  ('tx_gix_next', '0'),
  ('gix_backfill_height', '0')
ON CONFLICT (key) DO NOTHING;
