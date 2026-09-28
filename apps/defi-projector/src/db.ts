import pg from "pg";

const { Pool } = pg;

export function createPool(databaseUrl?: string) {
  const url =
    databaseUrl ||
    process.env.DATABASE_URL ||
    "postgres://ergoscan:changeme@127.0.0.1:5432/ergoscan";
  return new Pool({
    connectionString: url,
    max: Math.max(3, Number(process.env.PG_POOL_MAX || 4) || 4),
    idleTimeoutMillis: 30_000,
    statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS || 8_000),
  });
}

export type Db = pg.Pool;

export async function getState(db: Db, key: string): Promise<string | null> {
  const r = await db.query<{ value: string }>(
    `SELECT value FROM defi.worker_state WHERE key = $1`,
    [key]
  );
  return r.rows[0]?.value ?? null;
}

export async function setState(db: Db, key: string, value: string): Promise<void> {
  await db.query(
    `INSERT INTO defi.worker_state (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value]
  );
}
