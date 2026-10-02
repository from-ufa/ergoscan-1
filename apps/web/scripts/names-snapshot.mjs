#!/usr/bin/env node
// Bundle ergo-names into the site: resolved addresses (exact and NFT anchors) from the gateway book.
// Exchanges, mining pools and protocol boxes keep their own files: live or dead venue, rejected list, fee contract.
// Run before a web build: npm run names:snapshot -w @ergoscan/web
import { writeFileSync } from "node:fs";

const BOOK = process.env.NAMES_BOOK_URL ?? "https://ergoscan.me/api/v1/names/book";
const OUT = new URL("../src/lib/address-book/registry.json", import.meta.url);
const OWN_FILES = new Set(["exchange", "mining-pool", "protocol"]);

const r = await fetch(BOOK, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
if (!r.ok) throw new Error(`names book ${r.status}`);
const book = await r.json();
const entries = (book.items ?? [])
  .filter((it) => it.address && it.name && !OWN_FILES.has(it.project?.category))
  .map((it) => ({
    address: it.address,
    name: it.current === false ? `${it.name} (old)` : it.name,
    kind: it.kind === "wallet" ? "wallet" : "contract",
    note: it.project?.name ?? "",
    source: "registry",
    registry: { by: it.by === "project" ? "project" : "ergoscan", fileUrl: it.fileUrl },
  }))
  .sort((a, b) => a.address.localeCompare(b.address));

writeFileSync(
  OUT,
  JSON.stringify(
    {
      version: 1,
      note: "Generated from github.com/kayolo-ergoscan/ergo-names by npm run names:snapshot. Edit the registry, not this file.",
      commit: book.commit ?? null,
      entries,
    },
    null,
    2
  ) + "\n"
);
console.log(`registry.json: ${entries.length} names at ${book.commit ?? "unknown commit"}`);
