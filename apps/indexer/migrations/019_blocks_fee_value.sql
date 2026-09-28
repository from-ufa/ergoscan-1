-- Writer: block-level fee / output at indexHeight (AdaStat-style). List GET does not SUM txs.
ALTER TABLE blocks
  ADD COLUMN IF NOT EXISTS fee_nano NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS value_nano NUMERIC NOT NULL DEFAULT 0;
