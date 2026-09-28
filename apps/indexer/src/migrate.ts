/**
 * Apply SQL migrations in order from apps/indexer/migrations/
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createPool } from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(__dirname, "..", "migrations");

/** Count statements without executing a split. Skips -- comments and $tag$ bodies (see 003). */
function countSqlStatements(sql: string): number {
  let s = sql.replace(/\/\*[\s\S]*?\*\//g, " ");
  s = s.replace(/--[^\n]*/g, " ");
  s = s.replace(/\$[a-zA-Z0-9_]*\$[\s\S]*?\$[a-zA-Z0-9_]*\$/g, " ");
  return s
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean).length;
}

async function main() {
  const pool = createPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    const files = readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const f of files) {
      const id = f;
      const exists = await client.query(
        "SELECT 1 FROM schema_migrations WHERE id = $1",
        [id]
      );
      if (exists.rowCount) {
        console.log("skip", id);
        continue;
      }
      const sql = readFileSync(join(MIGRATIONS, f), "utf8");
      console.log("apply", id);
      // CREATE INDEX CONCURRENTLY cannot run inside a transaction.
      const concurrent = /\bCONCURRENTLY\b/i.test(sql);
      if (concurrent) {
        const n = countSqlStatements(sql);
        if (n !== 1) {
          throw new Error(
            `${id}: CREATE INDEX CONCURRENTLY must be the only statement in the file (${n} found). Postgres runs a multi-statement query as an implicit transaction (SQLSTATE 25001), and IF NOT EXISTS does not skip that check. One operator per file, like 008/009/015. Do not split on ';' to execute — dollar-quoted bodies in 003 would break.`
          );
        }
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [id]);
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [id]);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }
    console.log("migrate ok");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
