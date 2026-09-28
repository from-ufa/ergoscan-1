-- First / last height this address held the token (tip writer + UTXO replace).
ALTER TABLE token_balances ADD COLUMN IF NOT EXISTS first_height BIGINT;
ALTER TABLE token_balances ADD COLUMN IF NOT EXISTS last_height BIGINT;
