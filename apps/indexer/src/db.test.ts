import assert from "node:assert/strict";
import { test } from "node:test";
import type pg from "pg";
import { capStatements, releaseCapped } from "./db.js";

function fakeClient(failOn?: string) {
  const sql: string[] = [];
  const released: unknown[] = [];
  const client = {
    async query(text: string) {
      sql.push(text);
      if (failOn && text.startsWith(failOn)) throw new Error("connection gone");
      return { rows: [] };
    },
    release(err?: Error | boolean) {
      released.push(err);
    },
  } as unknown as pg.PoolClient;
  return { client, sql, released };
}

test("capStatements caps the session; releaseCapped clears it, then releases", async () => {
  const f = fakeClient();
  await capStatements(f.client, 8000);
  await releaseCapped(f.client);
  assert.deepEqual(f.sql, ["SET statement_timeout = 8000", "RESET statement_timeout"]);
  assert.deepEqual(f.released, [undefined]);
});

test("releaseCapped drops a client that cannot RESET instead of pooling the cap", async () => {
  const f = fakeClient("RESET");
  await releaseCapped(f.client);
  assert.equal(f.released.length, 1);
  assert.ok(f.released[0] instanceof Error);
});
