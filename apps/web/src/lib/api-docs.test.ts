import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DOCS_ACCESS_LINKS,
  DOCS_CONTRACT,
  DOCS_EXAMPLE_URLS,
  DOCS_LIMIT_ROWS,
  DOCS_ROUTES,
  DOCS_SPEC_PARAS,
  DOCS_TABS,
  readDocsTab,
  routesFor,
} from "./api-docs";

test("docs catalog is keyed and split by tab", () => {
  const ids = DOCS_ROUTES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...DOCS_TABS], ["start", "wallet", "chain", "tokens", "more"]);
  assert.equal(routesFor("start").length, 0);
  assert.ok(routesFor("wallet").length >= 8);
  assert.ok(routesFor("chain").length >= 6);
  assert.ok(routesFor("tokens").length >= 4);
  assert.ok(routesFor("more").length >= 4);
  assert.ok(DOCS_ROUTES.every((r) => r.path.startsWith("/") && r.title.en && r.title.ru && r.blurb.en && r.blurb.ru));
  const dump = JSON.stringify(DOCS_ROUTES);
  assert.equal(/official|ergoplatform|скрейп|not_implemented|\/boxes\/search/i.test(dump), false);
  assert.ok(DOCS_ROUTES.find((r) => r.id === "fees-hist"));
  assert.ok(DOCS_ROUTES.find((r) => r.id === "fees-eta"));
  assert.ok(DOCS_ROUTES.find((r) => r.id === "nfts-collection"));
  assert.ok(DOCS_ROUTES.find((r) => r.id === "nfts-issuer"));
  assert.ok(DOCS_ROUTES.find((r) => r.id === "defi-price-history"));
  assert.ok(DOCS_ROUTES.find((r) => r.id === "rent-box"));
  assert.ok(DOCS_ROUTES.find((r) => r.id === "page-rent"));
  assert.ok(DOCS_ROUTES.find((r) => r.id === "page-address"));
  const template = DOCS_ROUTES.find((r) => r.id === "boxes-template");
  assert.equal(template?.path, "/boxes/byErgoTreeTemplateHash/{hash}");
  assert.ok(template?.blurb.en.includes("SHA-256"));
  assert.ok(template?.blurb.ru.includes("шаблона"));
  assert.ok(DOCS_ROUTES.find((r) => r.id === "boxes-tree"));
  const feed = DOCS_ROUTES.find((r) => r.id === "oracles");
  const eip = DOCS_ROUTES.find((r) => r.id === "prices-erg-oracle");
  assert.equal(feed?.tryPath, "/v1/oracles/erg-usd?range=7d");
  assert.ok(feed?.blurb.en.includes("P2PK"));
  assert.ok(eip?.title.en.includes("EIP-23"));
  const gql = DOCS_ROUTES.find((r) => r.id === "graphql");
  assert.equal(gql?.method, "POST");
  assert.equal(gql?.path, "/graphql");
  assert.ok(gql?.query?.en.includes("405"));
  assert.ok(gql?.blurb.en.includes("rejected"));
  assert.ok(gql?.blurb.ru.includes("rejected"));
  const indexer = DOCS_ROUTES.find((r) => r.id === "indexer");
  assert.ok(indexer?.blurb.en.toLowerCase().includes("disk"));
});

test("start tab contract matches OpenAPI chapters", () => {
  assert.ok(DOCS_EXAMPLE_URLS.every((u) => u.startsWith("https://ergoscan.me/api/v1/")));
  assert.ok(DOCS_ACCESS_LINKS.some((l) => l.id === "openapi" && l.href.endsWith("/openapi.json")));
  assert.deepEqual([...DOCS_CONTRACT], ["intro", "spec", "cors", "auth", "page", "rate"]);
  assert.ok(DOCS_SPEC_PARAS.includes("amounts"));
  assert.ok(DOCS_SPEC_PARAS.includes("write"));
  assert.deepEqual([...DOCS_LIMIT_ROWS], ["rate", "submit", "over"]);
});

test("docs hash fallback is start", () => {
  assert.equal(readDocsTab(), "start");
});
