-- Activity sort for GET /v1/page/addresses (first/last height). Writer = indexer.
-- User GET is SELECT ... ORDER BY these indexes LIMIT/OFFSET.

CREATE INDEX IF NOT EXISTS address_summary_first_height_idx
  ON address_summary (first_height DESC NULLS LAST, address);

CREATE INDEX IF NOT EXISTS address_summary_last_height_idx
  ON address_summary (last_height DESC NULLS LAST, address);
