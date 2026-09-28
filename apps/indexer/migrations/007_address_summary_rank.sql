-- Holders list: rank by confirmed nanoERG. Writer = indexer seed + tip refresh.
-- Gateway GET /v1/page/addresses only SELECTs this table (or the addresses_top snapshot).
-- Do not COUNT/SUM boxes on the user path.

CREATE INDEX IF NOT EXISTS address_summary_nanoerg_idx
  ON address_summary (nanoerg DESC, address);

COMMENT ON TABLE address_summary IS
  'Confirmed UTXO nanoERG + counts. Writer = indexer (seed + touched). GET is SELECT only.';
