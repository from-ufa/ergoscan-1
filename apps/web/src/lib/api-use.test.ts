import assert from "node:assert/strict";
import { test } from "node:test";
import { parseApiUse } from "./api-use";

test("API use keeps counts and drops anything that is not a path total", () => {
  const use = parseApiUse(
    {
      generatedAt: "2026-10-07T19:00:00.000Z",
      apiHost: {
        host: "api.ergoscan.me",
        windows: {
          "1h": {
            requests: 12,
            clients: 3,
            graphql: 9,
            rest: 2,
            errors: 1,
            limited: 0,
            paths: [{ path: "/api/graphql", hits: 9 }, { path: "", hits: 4 }],
          },
          "24h": { requests: 40, clients: 8, graphql: 30, rest: 7 },
        },
      },
    },
    { ok: true, height: 1889616 }
  );
  assert.equal(use.ok, true);
  assert.equal(use.height, 1889616);
  assert.equal(use.hour?.requests, 12);
  assert.equal(use.hour?.clients, 3);
  assert.deepEqual(use.hour?.paths, [{ path: "/api/graphql", hits: 9 }]);
  assert.equal(use.day?.requests, 40);
  assert.equal(use.day?.graphql, 30);
});

test("a missing snapshot is an empty API card, not a crash", () => {
  const use = parseApiUse(null, null);
  assert.equal(use.ok, false);
  assert.equal(use.height, null);
  assert.equal(use.hour, null);
  assert.equal(use.day, null);
});
