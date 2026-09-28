-- ErgoScan DeFi overlay. Apply on Postgres.
-- docker exec -i ergoscan-pg psql -U ergoscan -d ergoscan < deploy/sql/001_defi_overlay.sql

CREATE SCHEMA IF NOT EXISTS defi;

CREATE TABLE IF NOT EXISTS defi.trades (
  id              BIGSERIAL PRIMARY KEY,
  tx_id           TEXT NOT NULL,
  box_id          TEXT,
  token_id        TEXT NOT NULL,
  base_id         TEXT NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
  side            TEXT NOT NULL,
  token_amount    NUMERIC NOT NULL,
  base_amount     NUMERIC NOT NULL,
  price           NUMERIC,
  trader          TEXT,
  pool_id         TEXT,
  height          INT,
  ts_ms           BIGINT NOT NULL,
  source          TEXT NOT NULL DEFAULT 'spectrum_detect',
  UNIQUE (tx_id, token_id, side)
);
CREATE INDEX IF NOT EXISTS defi_trades_token_ts ON defi.trades (token_id, ts_ms DESC);
CREATE INDEX IF NOT EXISTS defi_trades_ts ON defi.trades (ts_ms DESC);

CREATE TABLE IF NOT EXISTS defi.pool_snap (
  pool_id         TEXT PRIMARY KEY,
  token_id        TEXT NOT NULL,
  symbol          TEXT,
  tvl_erg         NUMERIC,
  volume_erg_24h  NUMERIC,
  price_erg       NUMERIC,
  updated_at_ms   BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS defi.ranks_cache (
  id              INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  payload_json    JSONB NOT NULL,
  updated_at_ms   BIGINT NOT NULL,
  source          TEXT NOT NULL DEFAULT 'lumen-defi'
);

CREATE TABLE IF NOT EXISTS defi.worker_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO defi.worker_state (key, value) VALUES ('schema_version', '1')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
