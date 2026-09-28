-- Per-address hot summary for GET /v1/addresses/:id (step 3).
-- Writer = indexer (touched addresses in the current height).
-- Gateway may lazy-fill one address via SUM/COUNT on that address only.
-- Do not OFFSET/COUNT the global boxes table for pagination.

CREATE TABLE IF NOT EXISTS address_summary (
  address      TEXT PRIMARY KEY,
  nanoerg      NUMERIC NOT NULL DEFAULT 0,
  box_count    INT NOT NULL DEFAULT 0,
  tx_count     INT NOT NULL DEFAULT 0,
  token_count  INT NOT NULL DEFAULT 0,
  last_height  BIGINT,
  first_height BIGINT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE address_summary IS
  'Confirmed UTXO nanoERG + counts. Writer = indexer. Amounts are NUMERIC (not JS Number).';

-- Keyset uses existing address_tx_addr_height_idx (address, height DESC).
-- Do not CREATE INDEX on address_tx at boot — it locks the table for minutes.
