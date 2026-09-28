-- ErgoScan indexer schema.

CREATE TABLE IF NOT EXISTS indexer_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blocks (
  height       BIGINT PRIMARY KEY,
  id           TEXT NOT NULL UNIQUE,
  timestamp_ms BIGINT NOT NULL,
  size         INT,
  tx_count     INT,
  difficulty   TEXT,
  parent_id    TEXT
);

CREATE INDEX IF NOT EXISTS blocks_id_idx ON blocks (id);
CREATE INDEX IF NOT EXISTS blocks_ts_idx ON blocks (timestamp_ms DESC);

CREATE TABLE IF NOT EXISTS transactions (
  id           TEXT PRIMARY KEY,
  height       BIGINT REFERENCES blocks(height) ON DELETE CASCADE,
  timestamp_ms BIGINT,
  size         INT,
  fee          BIGINT,
  index_in_block INT
);

CREATE INDEX IF NOT EXISTS transactions_height_idx ON transactions (height DESC);

CREATE TABLE IF NOT EXISTS boxes (
  box_id           TEXT PRIMARY KEY,
  creation_height  BIGINT,
  value_nano       BIGINT NOT NULL DEFAULT 0,
  ergo_tree        TEXT,
  address          TEXT,
  creation_tx_id   TEXT,
  spent_tx_id      TEXT,
  spent_height     BIGINT,
  -- node field `index` (output position in creation tx); added live via 004
  output_index     INT
);

-- Partial indexes: long P2S addresses can exceed btree 1/3-page limit
CREATE INDEX IF NOT EXISTS boxes_address_idx ON boxes (address)
  WHERE address IS NOT NULL AND length(address) <= 200;
CREATE INDEX IF NOT EXISTS boxes_unspent_idx ON boxes (address)
  WHERE spent_tx_id IS NULL AND address IS NOT NULL AND length(address) <= 200;
CREATE INDEX IF NOT EXISTS boxes_creation_height_idx ON boxes (creation_height);
CREATE INDEX IF NOT EXISTS boxes_null_addr_idx ON boxes (box_id) WHERE address IS NULL;

CREATE TABLE IF NOT EXISTS box_assets (
  box_id   TEXT NOT NULL REFERENCES boxes(box_id) ON DELETE CASCADE,
  token_id TEXT NOT NULL,
  amount   NUMERIC NOT NULL,
  PRIMARY KEY (box_id, token_id)
);

CREATE INDEX IF NOT EXISTS box_assets_token_idx ON box_assets (token_id);

CREATE TABLE IF NOT EXISTS tokens (
  token_id     TEXT PRIMARY KEY,
  name         TEXT,
  description  TEXT,
  decimals     INT,
  emission     NUMERIC,
  box_id       TEXT,
  first_height BIGINT
);

CREATE INDEX IF NOT EXISTS tokens_name_idx ON tokens (lower(name));

INSERT INTO indexer_state (key, value) VALUES
  ('schema_version', '1'),
  ('mode', 'tip'),
  ('last_height', '0')
ON CONFLICT (key) DO NOTHING;
