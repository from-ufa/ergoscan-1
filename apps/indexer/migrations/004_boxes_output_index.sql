-- Box output index (node field `index` / Ergo output index in creating tx).
-- Do not invent 0.

ALTER TABLE boxes
  ADD COLUMN IF NOT EXISTS output_index INT;

COMMENT ON COLUMN boxes.output_index IS
  'Output index in creation tx (node box.index). NULL until backfill.';

CREATE INDEX IF NOT EXISTS boxes_missing_output_index_idx
  ON boxes (creation_height DESC NULLS LAST)
  WHERE output_index IS NULL;
