-- Writer: every seen tx input. Closes leftover unspent boxes without REPAIR_SPENDS.
-- 021 remains unused. Do not copy this table into deploy/sql.
CREATE TABLE tx_inputs (
  box_id TEXT PRIMARY KEY,
  spent_tx_id TEXT NOT NULL,
  spent_height BIGINT NOT NULL
);

CREATE INDEX tx_inputs_spent_height_idx ON tx_inputs (spent_height);
