-- Writer: hourly fee SUM on snapshot_kv home. Not a user GET.
CREATE INDEX CONCURRENTLY IF NOT EXISTS transactions_timestamp_ms_idx
  ON transactions (timestamp_ms DESC);
