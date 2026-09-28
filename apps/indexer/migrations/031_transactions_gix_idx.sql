CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS transactions_gix_uidx ON transactions (gix) WHERE gix IS NOT NULL;
