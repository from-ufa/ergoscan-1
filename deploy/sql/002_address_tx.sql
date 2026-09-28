-- address_tx for fast address history
CREATE TABLE IF NOT EXISTS address_tx (
  address TEXT NOT NULL,
  tx_id TEXT NOT NULL,
  height BIGINT,
  PRIMARY KEY (address, tx_id)
);
CREATE INDEX IF NOT EXISTS address_tx_addr_height_idx
  ON address_tx (address, height DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS address_tx_height_idx
  ON address_tx (height);

CREATE TABLE IF NOT EXISTS indexer_checkpoint (
  name TEXT PRIMARY KEY,
  height BIGINT NOT NULL DEFAULT 0,
  updated_at_ms BIGINT NOT NULL DEFAULT 0
);
