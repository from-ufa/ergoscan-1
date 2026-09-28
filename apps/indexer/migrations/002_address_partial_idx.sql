-- Fix: full btree on address breaks on huge P2S script addresses
DROP INDEX IF EXISTS boxes_address_idx;
DROP INDEX IF EXISTS boxes_unspent_idx;
CREATE INDEX IF NOT EXISTS boxes_address_idx ON boxes (address)
  WHERE address IS NOT NULL AND length(address) <= 200;
CREATE INDEX IF NOT EXISTS boxes_unspent_idx ON boxes (address)
  WHERE spent_tx_id IS NULL AND address IS NOT NULL AND length(address) <= 200;
CREATE INDEX IF NOT EXISTS boxes_null_addr_idx ON boxes (box_id) WHERE address IS NULL;
