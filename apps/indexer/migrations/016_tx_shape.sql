-- Tx shape: chain facts on the writer path. Additive. GET never computes this.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS shape TEXT,
  ADD COLUMN IF NOT EXISTS protocol TEXT,
  ADD COLUMN IF NOT EXISTS rule_id TEXT,
  ADD COLUMN IF NOT EXISTS rules_version INT;
