/**
 * Pool labels for miner reward addresses. Writer-side only — not an explorer GET.
 * Generated from apps/web/src/lib/address-book/pools.json (extract:known-kinds).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PATH = join(dirname(fileURLToPath(import.meta.url)), "known-miners.json");

let names: Record<string, string> | null = null;

function catalog(): Record<string, string> {
  if (names) return names;
  names = JSON.parse(readFileSync(PATH, "utf8")) as Record<string, string>;
  return names;
}

/** Known pool name, or a truncated reward address (ergo.watch style). */
export function minerName(address: string): string {
  const n = catalog()[address];
  if (n) return n;
  if (address.length <= 14) return address;
  return `${address.slice(0, 2)}…${address.slice(-8)}`;
}

/**
 * Autolykos pool P2S (`88…`) or a short P2PK. Skips the emission/fee boxes
 * that lead every reward tx (long `2…` contracts, same every block).
 */
export function isMinerPayAddress(address: string): boolean {
  if (address.startsWith("88")) return true;
  if (address.startsWith("9") && address.length >= 50 && address.length < 70) return true;
  return false;
}
