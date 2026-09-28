-- Live /defi pool rail: last fill per pool_id without seq-scan of defi.trades.
CREATE INDEX CONCURRENTLY IF NOT EXISTS defi_trades_live_pool_ts
  ON defi.trades (pool_id, ts_ms DESC)
  WHERE source IN ('spectrum_detect', 'projector')
    AND pool_id IS NOT NULL;
