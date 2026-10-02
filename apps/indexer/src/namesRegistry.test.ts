import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readNameRegistry, resolveNameAddresses, type AnchorHolder } from "./namesRegistry.js";

const POOL = "PViBL5acX6PmcLAsSXs28sVwRvGDWo54AFUenax4vGf7yNX58TXrAUQUcKAL3HuKz8Rhvzm3ZUGkuZAdtFcjehTV7To1EF";
const OLD_POOL = "PViBL5acX6PkLJoBexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexamplex";
const WALLET = "9fRAWhdxEsTcdb8PhGNrZfwqa65zfkuYHAMmkQLcic1gdLSV5vA";
const NFT = "f7f008ad8fcaad4490d8e78ab6d3f11efe7213a13f7b243795818b155e1acc92";

function registry(): string {
  const dir = mkdtempSync(join(tmpdir(), "names-"));
  mkdirSync(join(dir, "projects"));
  writeFileSync(
    join(dir, "projects", "moracle.json"),
    JSON.stringify({
      id: "moracle",
      name: "MORACLE",
      category: "oracle",
      by: "ergoscan",
      contracts: [
        { name: "MORACLE Pool", kind: "contract", match: { token: NFT }, source: "chain" },
        { name: "MORACLE Pool v0", kind: "contract", match: { address: OLD_POOL }, source: "chain", until: 1160000 },
        { name: "MORACLE swap order", kind: "contract", match: { template: "ab".repeat(32) }, source: "https://example.org" },
      ],
    })
  );
  return dir;
}

test("registry files flatten to one row per contract, with the project and file", () => {
  const rows = readNameRegistry(registry());
  assert.equal(rows.length, 3);
  const pool = rows.find((r) => r.matchKind === "token");
  assert.equal(pool?.name, "MORACLE Pool");
  assert.equal(pool?.projectId, "moracle");
  assert.equal(pool?.file, "moracle.json");
  assert.equal(rows.find((r) => r.matchKind === "address")?.until, 1160000);
  assert.equal(rows.find((r) => r.matchKind === "template")?.by, "ergoscan");
});

test("an exact address beats an anchor, and an anchor never names a wallet", () => {
  const entries = readNameRegistry(registry());
  const anchors = new Map<string, AnchorHolder[]>([
    [
      NFT,
      [
        { address: POOL, firstHeight: 1700000, lastHeight: 1885000, current: true },
        { address: OLD_POOL, firstHeight: 1100000, lastHeight: 1160000, current: false },
        { address: WALLET, firstHeight: 1099000, lastHeight: 1099000, current: false },
      ],
    ],
  ]);
  const rows = resolveNameAddresses(entries, anchors);
  assert.deepEqual(
    rows.map((r) => [r.address.slice(0, 16), r.matchKind, r.current]),
    [
      [OLD_POOL.slice(0, 16), "address", true],
      [POOL.slice(0, 16), "token", true],
    ]
  );
});
