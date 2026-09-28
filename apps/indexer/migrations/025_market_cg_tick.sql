-- Oracle ERG/USD + CoinGecko extras. Writer = indexer on a successful poll
-- (every 2 tip blocks). Current values still live on snapshot_kv home for GET.
-- Missed days cannot be backfilled from chain (CG extras) or easily from spent
-- oracle boxes until a dedicated history materializer exists.

CREATE TABLE IF NOT EXISTS market_cg_tick (
  ts_ms      BIGINT PRIMARY KEY,
  height     BIGINT NOT NULL,
  erg_usd    DOUBLE PRECISION,
  rank       INT,
  volume24h  DOUBLE PRECISION,
  change24h  DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS market_cg_tick_height_idx ON market_cg_tick (height DESC);

COMMENT ON TABLE market_cg_tick IS
  'Oracle ERG/USD + CoinGecko rank / 24h volume / 24h %. Append-only on indexer poll (every 2 tip blocks). Analog: adastat_price_history.';
