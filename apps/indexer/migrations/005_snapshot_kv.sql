-- List snapshots for gateway GET /v1/blocks, /v1/transactions/recent, /v1/page/home.
-- Indexer writes after a tip tick. Gateway never fans out to the Ergo node for lists.

CREATE TABLE IF NOT EXISTS snapshot_kv (
  key         TEXT PRIMARY KEY,
  payload     JSONB NOT NULL,
  height      BIGINT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE snapshot_kv IS
  'Hot list JSON: blocks_latest, txs_recent, indexer_status, home. Writer = indexer.';

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS input_count INT,
  ADD COLUMN IF NOT EXISTS output_count INT,
  ADD COLUMN IF NOT EXISTS value_nano NUMERIC;
