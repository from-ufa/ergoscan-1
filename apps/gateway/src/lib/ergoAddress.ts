/**
 * Ergo address ↔ ergoTree without hitting the node.
 * Node unconfirmed txs expose ergoTree, not Base58 — encode locally for mempool I/O.
 */
import { timingSafeEqual } from "node:crypto";
import { blake2b } from "@noble/hashes/blake2.js";
import type { RawTx } from "@ergoscan/shared";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ADDR_MAX_LEN = 2000;
/** Mainnet P2PK 0x01, P2SH 0x02, P2S 0x03. Testnet +0x10. */
const ADDR_PREFIXES = new Set([0x01, 0x02, 0x03, 0x11, 0x12, 0x13]);
const P2PK_TREE = /^0008cd[0-9a-f]{66}$/;

const treeMemo = new Map<string, string | null>();
const addrMemo = new Map<string, string | null>();
const TREE_MEMO_MAX = 400;

function b58Decode(s: string): Buffer | null {
  if (!s || s.length < 5) return null;
  let n = 0n;
  for (const ch of s) {
    const i = B58.indexOf(ch);
    if (i < 0) return null;
    n = n * 58n + BigInt(i);
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  let pad = 0;
  for (const ch of s) {
    if (ch === "1") pad += 1;
    else break;
  }
  const body = Buffer.from(hex, "hex");
  return pad ? Buffer.concat([Buffer.alloc(pad), body]) : body;
}

function b58Encode(buf: Buffer): string {
  let zeros = 0;
  while (zeros < buf.length && buf[zeros] === 0) zeros += 1;
  let n = 0n;
  for (const b of buf) n = (n << 8n) + BigInt(b);
  let s = "";
  while (n > 0n) {
    s = `${B58[Number(n % 58n)]}${s}`;
    n /= 58n;
  }
  return `${"1".repeat(zeros)}${s}`;
}

/**
 * Ergo address checksum: blake2b256(prefix || content)[0:4]
 * vs the last 4 bytes of Base58 decode. Prefix must be P2PK/P2SH/P2S
 * (mainnet or testnet). P2SH can be 39 chars — do not require 51.
 */
export function isErgoAddressChecksumValid(s: string): boolean {
  if (s.length > ADDR_MAX_LEN) return false;
  const raw = b58Decode(s);
  if (!raw || raw.length < 6) return false;
  const prefix = raw[0]!;
  if (!ADDR_PREFIXES.has(prefix)) return false;
  const payload = raw.subarray(0, raw.length - 4);
  const sum = raw.subarray(raw.length - 4);
  if (payload.length < 2) return false;
  const digest = blake2b(payload, { dkLen: 32 });
  try {
    return timingSafeEqual(Buffer.from(digest.subarray(0, 4)), sum);
  } catch {
    return false;
  }
}

export function normErgoTree(tree: unknown): string | null {
  if (typeof tree !== "string" || tree.length < 4) return null;
  const t = tree.startsWith("0x") ? tree.slice(2) : tree;
  const hex = t.toLowerCase();
  return /^[0-9a-f]+$/.test(hex) ? hex : null;
}

/** Mainnet/testnet P2PK → `0008cd` + compressed pubkey. P2S content is the tree. */
export function ergoTreeFromAddress(address: string): string | null {
  if (treeMemo.has(address)) return treeMemo.get(address) ?? null;
  let tree: string | null = null;
  const raw = b58Decode(address);
  if (raw && raw.length >= 6) {
    const prefix = raw[0];
    const content = raw.subarray(1, raw.length - 4);
    if (content.length > 0) {
      const hex = content.toString("hex");
      if (prefix === 0x01 || prefix === 0x11) {
        tree = `0008cd${hex}`;
      } else if (prefix === 0x03 || prefix === 0x13) {
        tree = hex;
      }
    }
  }
  if (treeMemo.size >= TREE_MEMO_MAX) treeMemo.clear();
  treeMemo.set(address, tree);
  return tree;
}

/**
 * Mainnet: P2PK tree `0008cd`+pubkey → prefix 0x01; any other tree → P2S prefix 0x03.
 * Does not call the node.
 */
export function addressFromErgoTree(
  tree: unknown,
  network: "mainnet" | "testnet" = "mainnet"
): string | null {
  const hex = normErgoTree(tree);
  if (!hex) return null;
  const key = `${network}:${hex}`;
  if (addrMemo.has(key)) return addrMemo.get(key) ?? null;
  const p2pk = P2PK_TREE.test(hex);
  const content = Buffer.from(p2pk ? hex.slice(6) : hex, "hex");
  if (content.length < 1) return null;
  const prefix = network === "testnet" ? (p2pk ? 0x11 : 0x13) : p2pk ? 0x01 : 0x03;
  const payload = Buffer.concat([Buffer.from([prefix]), content]);
  const digest = blake2b(payload, { dkLen: 32 });
  const raw = Buffer.concat([payload, Buffer.from(digest.subarray(0, 4))]);
  const addr = b58Encode(raw);
  const ok = addr.length > 0 && addr.length <= ADDR_MAX_LEN ? addr : null;
  if (addrMemo.size >= TREE_MEMO_MAX) addrMemo.clear();
  addrMemo.set(key, ok);
  return ok;
}

type TreeBox = {
  address?: string;
  ergoTree?: string;
};

/** Fill Base58 from ergoTree when the node omitted it. No REST. */
export function boxWithTreeAddress<T extends TreeBox>(
  box: T,
  network: "mainnet" | "testnet" = "mainnet"
): T {
  try {
    if (!box || typeof box !== "object") return box;
    const given = typeof box.address === "string" ? box.address.trim() : "";
    if (given) return box;
    const addr = addressFromErgoTree(box.ergoTree, network);
    return addr ? { ...box, address: addr } : box;
  } catch {
    return box;
  }
}

/** Mempool dump: trees on boxes, addresses often missing. */
export function txWithTreeAddresses(
  tx: RawTx,
  network: "mainnet" | "testnet" = "mainnet"
): RawTx {
  try {
    const fill = <T extends TreeBox>(box: T) => boxWithTreeAddress(box, network);
    return {
      ...tx,
      inputs: Array.isArray(tx.inputs) ? tx.inputs.map(fill) : tx.inputs,
      outputs: Array.isArray(tx.outputs) ? tx.outputs.map(fill) : tx.outputs,
      dataInputs: Array.isArray(tx.dataInputs) ? tx.dataInputs.map(fill) : tx.dataInputs,
    };
  } catch {
    return tx;
  }
}
