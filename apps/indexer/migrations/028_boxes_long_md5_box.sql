-- Keyset (md5, box_id). md5-only index forces Incremental Sort of the
-- remaining boxes on a fat P2S — 500-row pick became ~110s.
CREATE INDEX CONCURRENTLY IF NOT EXISTS boxes_long_md5_box_idx
  ON boxes (md5(address), box_id)
  WHERE address IS NOT NULL AND length(address) > 200;
