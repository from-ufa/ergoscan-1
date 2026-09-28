-- Writer: 24h hashrate share on snapshot_kv home. Reward address + miner pk.
ALTER TABLE blocks
  ADD COLUMN IF NOT EXISTS miner_pk TEXT,
  ADD COLUMN IF NOT EXISTS miner_address TEXT;
