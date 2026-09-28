-- 2026-08-14 · trader backfill + my-fills filter
CREATE INDEX IF NOT EXISTS address_tx_tx_id_idx ON public.address_tx (tx_id);
CREATE INDEX IF NOT EXISTS defi_trades_trader_ts ON defi.trades (trader, ts_ms DESC)
  WHERE trader IS NOT NULL AND trader <> '';
