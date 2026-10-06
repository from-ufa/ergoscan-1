import assert from "node:assert/strict";
import { test } from "node:test";
import {
  API_NOT_SERVED,
  API_PUBLIC_ORIGIN,
  API_WALLET_PATHS,
  apiContractHtml,
  apiContractMarkdown,
} from "./api-contract.js";

test("API contract names the host, string amounts, and the 501 holes", () => {
  const md = apiContractMarkdown();
  const html = apiContractHtml();
  for (const doc of [md, html]) {
    assert.ok(doc.includes(API_PUBLIC_ORIGIN));
    assert.ok(doc.includes("Decimal strings") || doc.includes("decimal strings"));
    assert.ok(doc.includes("120 requests per minute"));
    assert.ok(doc.includes("not_implemented"));
    assert.ok(doc.includes("globalIndex"));
    assert.ok(doc.includes("/v1/page/*"));
    for (const row of API_NOT_SERVED) {
      assert.ok(doc.includes(row.path), row.path);
    }
    for (const row of API_WALLET_PATHS) {
      assert.ok(doc.includes(row.split(" ")[1] ?? row), row);
    }
  }
  assert.equal(/9053|127\.0\.0\.1|DATABASE_URL|diskFree|Caddy/i.test(md + html), false);
  assert.ok(html.startsWith("<!DOCTYPE html>"));
  assert.ok(html.includes("<table>"));
});
