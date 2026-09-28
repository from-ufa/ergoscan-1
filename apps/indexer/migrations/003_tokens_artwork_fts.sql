-- P2-9: artwork cache + full-text name search for indexed tokens
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS artwork_url TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS name_tsv tsvector;

UPDATE tokens SET name_tsv = to_tsvector('simple', coalesce(name, ''))
WHERE name IS NOT NULL AND name_tsv IS NULL;

CREATE INDEX IF NOT EXISTS tokens_name_tsv_idx ON tokens USING gin (name_tsv);
CREATE INDEX IF NOT EXISTS tokens_name_trgm_ready ON tokens (name text_pattern_ops);

-- trigger to keep name_tsv in sync
CREATE OR REPLACE FUNCTION tokens_name_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW.name_tsv := to_tsvector('simple', coalesce(NEW.name, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tokens_name_tsv_trg ON tokens;
CREATE TRIGGER tokens_name_tsv_trg
  BEFORE INSERT OR UPDATE OF name ON tokens
  FOR EACH ROW EXECUTE FUNCTION tokens_name_tsv_update();
