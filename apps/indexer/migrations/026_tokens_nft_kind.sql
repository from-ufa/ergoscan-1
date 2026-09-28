-- EIP-4 R7 subtype on tokens (image/audio/video/…). Filled by the PG writer, not the node.
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS nft_kind TEXT;
CREATE INDEX IF NOT EXISTS tokens_nft_kind_e1_idx
  ON tokens (nft_kind)
  WHERE emission = 1 AND nft_kind IS NOT NULL;
