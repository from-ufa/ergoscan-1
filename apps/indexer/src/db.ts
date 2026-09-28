import pg from "pg";

const { Pool } = pg;

export function createPool(databaseUrl?: string) {
  const url =
    databaseUrl ||
    process.env.DATABASE_URL ||
    "postgres://ergoscan:changeme@127.0.0.1:5432/ergoscan";
  return new Pool({
    connectionString: url,
    max: 4,
    idleTimeoutMillis: 30_000,
  });
}

export type Db = pg.Pool;
