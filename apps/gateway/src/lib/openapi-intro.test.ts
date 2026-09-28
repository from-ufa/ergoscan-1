import assert from "node:assert/strict";
import { test } from "node:test";
import { OPENAPI_INFO_DESCRIPTION } from "./openapi-intro.js";

test("OpenAPI intro is the public API contract", () => {
  for (const h of [
    "# Introduction",
    "# API Specification",
    "# Cross-Origin Resource Sharing",
    "# Authentication",
    "# Pagination",
    "# Rate Limit",
  ]) {
    assert.ok(OPENAPI_INFO_DESCRIPTION.includes(h), h);
  }
  assert.ok(OPENAPI_INFO_DESCRIPTION.includes("120 requests per minute"));
  assert.ok(OPENAPI_INFO_DESCRIPTION.includes("10 per minute"));
  assert.ok(OPENAPI_INFO_DESCRIPTION.includes("decimal **strings**"));
  assert.ok(OPENAPI_INFO_DESCRIPTION.includes("hasMore"));
  assert.ok(OPENAPI_INFO_DESCRIPTION.includes("Access-Control-Allow-Origin: *"));
  assert.ok(OPENAPI_INFO_DESCRIPTION.includes("https://ergoscan.me/docs"));
  assert.equal(/9053|127\.0\.0\.1|diskFree|Caddy|ufw|not_implemented|#501/i.test(OPENAPI_INFO_DESCRIPTION), false);
});
