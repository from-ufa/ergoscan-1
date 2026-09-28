-- Token tx tape: keyset on (token_id, height DESC, tx_id), not JOIN 270k+ rows per GET.
ALTER TABLE token_tx_seen ADD COLUMN IF NOT EXISTS height BIGINT;

CREATE OR REPLACE FUNCTION token_tx_seen_fill_height()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.height IS NULL AND NEW.tx_id IS NOT NULL THEN
    SELECT t.height INTO NEW.height FROM transactions t WHERE t.id = NEW.tx_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS token_tx_seen_height_tg ON token_tx_seen;
CREATE TRIGGER token_tx_seen_height_tg
BEFORE INSERT OR UPDATE OF tx_id ON token_tx_seen
FOR EACH ROW
EXECUTE FUNCTION token_tx_seen_fill_height();
