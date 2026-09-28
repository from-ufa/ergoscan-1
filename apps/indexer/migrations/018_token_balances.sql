-- Incremental token holders / txs (AdaStat-style). Writer-only.
-- Catalog KPIs = unique addresses / unique txs, not SUM of per-token columns.

CREATE TABLE IF NOT EXISTS token_balances (
  token_id TEXT NOT NULL,
  address  TEXT NOT NULL,
  amount   NUMERIC NOT NULL DEFAULT 0,
  PRIMARY KEY (token_id, address)
);

CREATE INDEX IF NOT EXISTS token_balances_addr_idx
  ON token_balances (address)
  WHERE amount > 0;

CREATE TABLE IF NOT EXISTS token_tx_seen (
  token_id TEXT NOT NULL,
  tx_id    TEXT NOT NULL,
  PRIMARY KEY (token_id, tx_id)
);

CREATE TABLE IF NOT EXISTS token_tx_ids (
  tx_id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS token_catalog_stats (
  id              BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  unique_holders  INT NOT NULL DEFAULT 0,
  unique_txs      BIGINT NOT NULL DEFAULT 0,
  seed_phase      TEXT NOT NULL DEFAULT 'balances',
  seed_lo         BIGINT,
  seed_hi         BIGINT,
  seed_height     BIGINT NOT NULL DEFAULT 0,
  seed_box_id     TEXT NOT NULL DEFAULT ''
);

INSERT INTO token_catalog_stats (id) VALUES (TRUE)
ON CONFLICT (id) DO NOTHING;
