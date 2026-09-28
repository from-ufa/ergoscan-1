-- Holder tape: keyset / ORDER BY amount on one token (not PK token_id, address).
CREATE INDEX IF NOT EXISTS token_balances_token_amount_idx
  ON token_balances (token_id, amount DESC, address)
  WHERE amount > 0;
