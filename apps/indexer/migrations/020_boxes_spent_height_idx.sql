-- Writer: boxes spent at a height. touchedAddressesAtHeight. Not a user GET.
CREATE INDEX CONCURRENTLY IF NOT EXISTS boxes_spent_height_idx
  ON boxes (spent_height) WHERE spent_height IS NOT NULL;
