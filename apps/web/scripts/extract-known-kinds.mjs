/**
 * Slim address lists for the indexer snapshot. Same pip rules as the web book.
 * Protocol from protocol.json. Exchange = live mains in exchanges.json.
 * Pool names from pools.json; indexer also treats every 88… as miner-reward P2S.
 *
 *   npm run extract:known-kinds -w @ergoscan/web
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bookDir = join(root, "src", "lib", "address-book");
const indexerSrc = join(root, "..", "indexer", "src");
const dest = join(indexerSrc, "known-kinds.json");
const minersDest = join(indexerSrc, "known-miners.json");

function load(name) {
  return JSON.parse(readFileSync(join(bookDir, name), "utf8"));
}

const overrides = load("overrides.json");
const protocol = load("protocol.json");
const exchanges = load("exchanges.json");
const poolsFile = load("pools.json");

const byAddr = new Map();
for (const e of protocol.entries ?? []) {
  if (!e?.address) continue;
  byAddr.set(e.address, { ...e, kind: "protocol" });
}

const liveCex = new Set();
for (const venue of exchanges.venues ?? []) {
  const live = venue.status === "live";
  for (const entry of venue.entries ?? []) {
    if (!entry?.address || !venue.name) continue;
    byAddr.set(entry.address, {
      address: entry.address,
      name: venue.name,
      kind: "exchange",
      url: venue.url,
      source: entry.source,
    });
    if (live) liveCex.add(entry.address);
  }
}
for (const row of exchanges.rejected ?? []) {
  if (!row?.address) continue;
  byAddr.set(row.address, {
    address: row.address,
    name: row.name ?? "Not a CEX main",
    kind: row.kind ?? "wallet",
    note: row.reason,
    source: row.source,
  });
}
const minerNames = {};
for (const venue of poolsFile.venues ?? []) {
  for (const entry of venue.entries ?? []) {
    if (!entry?.address || !venue.name) continue;
    byAddr.set(entry.address, {
      address: entry.address,
      name: venue.name,
      kind: "pool",
      url: venue.url,
      source: "stage",
    });
    minerNames[entry.address] = venue.name;
  }
}
for (const e of overrides.entries ?? []) {
  if (e?.address) byAddr.set(e.address, e);
}

const lists = { protocol: new Set(), exchange: liveCex, pool: new Set() };
const fee = protocol.fee;
for (const [addr, e] of byAddr) {
  if (addr === fee || e.kind === "miner" || e.kind === "protocol") {
    lists.protocol.add(addr);
    continue;
  }
  if (e.kind === "pool") lists.pool.add(addr);
}

const out = {
  protocol: [...lists.protocol].sort(),
  exchange: [...lists.exchange].sort(),
  pool: [...lists.pool].sort(),
};
writeFileSync(dest, `${JSON.stringify(out, null, 2)}\n`);
writeFileSync(minersDest, `${JSON.stringify(minerNames, null, 2)}\n`);
console.log(
  `protocol ${out.protocol.length}  exchange ${out.exchange.length}  pool ${out.pool.length} → ${dest}`
);
console.log(`miners ${Object.keys(minerNames).length} → ${minersDest}`);
