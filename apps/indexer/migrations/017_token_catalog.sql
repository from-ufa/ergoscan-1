-- Token catalog stats for GET /v1/tokens (AdaStat-style list). Writer-only.
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS last_height BIGINT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS holders INT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS tx_count INT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS unspent_boxes INT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS stats_height BIGINT;

CREATE INDEX IF NOT EXISTS tokens_last_height_idx
  ON tokens (last_height DESC NULLS LAST, token_id DESC);
CREATE INDEX IF NOT EXISTS tokens_first_height_idx
  ON tokens (first_height DESC NULLS LAST, token_id DESC);
CREATE INDEX IF NOT EXISTS tokens_holders_idx
  ON tokens (holders DESC NULLS LAST, token_id DESC);
CREATE INDEX IF NOT EXISTS tokens_tx_count_idx
  ON tokens (tx_count DESC NULLS LAST, token_id DESC);
CREATE INDEX IF NOT EXISTS tokens_emission_idx
  ON tokens (emission DESC NULLS LAST, token_id DESC);
