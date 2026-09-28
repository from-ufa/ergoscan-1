import pg from "pg";

const { Pool } = pg;

export function createPool(databaseUrl?: string) {
  const url =
    databaseUrl ||
    process.env.DATABASE_URL ||
    "postgres://ergoscan:changeme@127.0.0.1:5432/ergoscan";
  return new Pool({
    connectionString: url,
    max: 2,
    application_name: "oracle-projector",
    idleTimeoutMillis: 30_000,
    statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS || 25_000),
    options: `-c lock_timeout=${process.env.PG_LOCK_TIMEOUT || "20s"}`,
  });
}

export type Db = pg.Pool;
export type Queryable = Pick<pg.Pool | pg.PoolClient, "query">;

export const ADVISORY_LOCK = 879_601;

export async function getState(db: Queryable, key: string): Promise<string | null> {
  const r = await db.query<{ value: string }>(
    `SELECT value FROM oracle.worker_state WHERE key = $1`,
    [key]
  );
  return r.rows[0]?.value ?? null;
}

export async function setState(db: Queryable, key: string, value: string): Promise<void> {
  await db.query(
    `INSERT INTO oracle.worker_state (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value]
  );
}
