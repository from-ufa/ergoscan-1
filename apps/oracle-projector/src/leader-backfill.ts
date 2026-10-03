/**
 * One pass over v2 USD and gold refresh history.
 * Run once. The projector then keeps the tip.
 */
import { createPool, setState } from "./db.js";
import { allRefreshTxs, battleFeeds, LEADER_HEIGHT_KEY, rebuildWinTotals, recordLeaders } from "./leader.js";
import { ensureOracleSchema } from "./schema.js";
import { execFileSync } from "node:child_process";

function databaseUrl(): string {
  const raw = execFileSync("systemctl", ["show", "ergoscan-oracle-projector", "-p", "Environment", "--value"], {
    encoding: "utf8",
  });
  for (const part of raw.split(/\s+/)) {
    if (part.startsWith("DATABASE_URL=")) return part.slice("DATABASE_URL=".length);
  }
  throw new Error("projector database url missing");
}

async function main(): Promise<void> {
  const db = createPool(databaseUrl());
  const client = await db.connect();
  try {
    await client.query("SET statement_timeout = '120s'");
    await client.query("SET enable_hashjoin = off");
    await client.query("SET enable_mergejoin = off");
    await ensureOracleSchema(client);
    let maxHeight = 0;
    for (const feed of battleFeeds()) {
      const txs = await allRefreshTxs(client, feed.refreshNft);
      const wrote = await recordLeaders(client, feed, txs);
      const top = txs.reduce((m, row) => Math.max(m, row.height), 0);
      if (top > maxHeight) maxHeight = top;
      console.log(JSON.stringify({ slug: feed.slug, slots: txs.length, newRows: wrote, top }));
    }
    await rebuildWinTotals(client);
    if (maxHeight > 0) await setState(client, LEADER_HEIGHT_KEY, String(maxHeight));
    const totals = await client.query<{ slug: string; n: string }>(
      `SELECT slug, count(*)::text AS n FROM oracle.leader GROUP BY slug ORDER BY slug`
    );
    console.log(JSON.stringify({ stored: totals.rows, cursor: maxHeight }));
  } finally {
    client.release();
    await db.end();
  }
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : "";
  console.error(msg.includes("postgres://") ? "backfill failed" : msg || "backfill failed");
  process.exit(1);
});
