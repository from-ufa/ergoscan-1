import assert from "node:assert/strict";
import { test } from "node:test";
import { nameFromRow, registryFileUrl, templateTreeOf } from "./names.js";

test("a wallet never gets a template name, a P2S does", () => {
  assert.equal(templateTreeOf("9hFmeUHVttZmgtq4DEosEzJb3bTjx9HMJVptmMgfaHH9tYyGYTE"), null);
  const p2s =
    "2iHkR7CWvD1R4j1yZg5bkeDRQavjAaVPeTDFGGLZduHyfWMuYpmhHocX8GJoaieTx78FntzJbCBVL6rf96ocJoZdmWBL2fci7NqWgAirppPQmZ7fN9V6z13Ay6brPriBKYqLp1bT2Fk4FkFLCfdPpe";
  assert.match(templateTreeOf(p2s) ?? "", /^1005/);
});

test("registry rows keep provenance and link to the project file", () => {
  const n = nameFromRow({
    name: "XAU/ERG Oracle Refresh (2023)",
    kind: "contract",
    project_id: "oracle-pools",
    project_name: "Oracle pools",
    category: "oracle",
    by_whom: "ergoscan",
    via: "token",
    current: false,
    until_height: null,
    file: "oracle-pools.json",
  });
  assert.equal(n.via, "token");
  assert.equal(n.current, false);
  assert.equal(n.by, "ergoscan");
  assert.equal(n.fileUrl, registryFileUrl("oracle-pools.json"));
  assert.match(n.fileUrl, /^https:\/\/github\.com\/kayolo-ergoscan\/ergo-names\/blob\/main\/projects\/oracle-pools\.json$/);
});
