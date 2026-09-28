import { formatRelAge } from "./format";
import { tokenIdenticonSrc } from "./token-identicon";

/** 30d — last post older than this reads as “very long ago”. */
export const ORACLE_ANCIENT_MS = 30 * 86_400_000;
export const ORACLE_BLOCK_MS_FALLBACK = 120_000;

/** Short callsigns — stable for an address, not a numbered list. */
const HEADS = [
  "Ash",
  "Brine",
  "Cinder",
  "Dusk",
  "Ember",
  "Flint",
  "Grove",
  "Halo",
  "Iota",
  "Jasper",
  "Kite",
  "Lumen",
  "Mire",
  "Nox",
  "Oath",
  "Pyre",
  "Quartz",
  "Rune",
  "Sable",
  "Thorn",
  "Ulna",
  "Vale",
  "Wick",
  "Yarrow",
] as const;

const TAILS = [
  "Anvil",
  "Beacon",
  "Cipher",
  "Drift",
  "Forge",
  "Glyph",
  "Hearth",
  "Loom",
  "Merkle",
  "Nock",
  "Quill",
  "Ridge",
  "Spire",
  "Vault",
  "Atlas",
  "Coil",
  "Finch",
  "Harbor",
  "Keel",
  "Warden",
] as const;

export type CouncilEdge = { a: number; b: number };

export function oracleSeedHex(seed: string): string {
  const src = String(seed || "0");
  const parts: string[] = [];
  for (let round = 0; round < 4; round++) {
    let h = 2166136261;
    const t = `${round}:${src}`;
    for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619);
    parts.push((h >>> 0).toString(16).padStart(8, "0"));
  }
  return parts.join("");
}

export function oracleOperatorMarkSrc(seed: string): string {
  return tokenIdenticonSrc(oracleSeedHex(seed));
}

export function oracleOperatorName(seed: string): string {
  const hex = oracleSeedHex(seed);
  const n = Number.parseInt(hex.slice(0, 8), 16);
  if (!Number.isFinite(n)) return "Ash Anvil";
  const head = HEADS[n % HEADS.length]!;
  const tail = TAILS[Math.floor(n / HEADS.length) % TAILS.length]!;
  return `${head} ${tail}`;
}

/** Same base name twice → "Ash Loom 2". Book names stay as-is. */
export function uniqueOracleNames(seeds: string[]): string[] {
  const raw = seeds.map((s) => oracleOperatorName(s));
  const counts = new Map<string, number>();
  for (const name of raw) counts.set(name, (counts.get(name) ?? 0) + 1);
  const seen = new Map<string, number>();
  return raw.map((name) => {
    if ((counts.get(name) ?? 0) < 2) return name;
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    return n === 1 ? name : `${name} ${n}`;
  });
}

/** Lattice: neighbor to the right and below. They read as one bound set. */
export function oracleCouncilMesh(n: number, cols: number): CouncilEdge[] {
  const count = Math.max(0, Math.floor(n));
  const width = Math.max(1, Math.floor(cols));
  const edges: CouncilEdge[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % width;
    if (col + 1 < width && i + 1 < count) edges.push({ a: i, b: i + 1 });
    if (i + width < count) edges.push({ a: i, b: i + width });
  }
  return edges;
}

export function oracleOperatorSeed(op: { address?: string | null; boxId?: string | null; id?: string }): string {
  return op.address || op.boxId || op.id || "0";
}

const ERG = 1_000_000_000n;

/** Confirmed ERG on the operator P2PK below 1.0 — tape blinks. */
export function oracleErgLow(nano: string | number | null | undefined): boolean {
  if (nano == null || nano === "") return false;
  try {
    const n = typeof nano === "bigint" ? nano : BigInt(String(nano).split(".")[0] || "0");
    return n >= 0n && n < ERG;
  } catch {
    return false;
  }
}

export function oracleWhenLabel(input: {
  tsMs: number | null;
  height: number | null;
  tipHeight: number | null;
  locale: string;
  ancient: string;
  now?: number;
}): string {
  const now = input.now ?? Date.now();
  if (input.tsMs != null && Number.isFinite(input.tsMs)) {
    if (now - input.tsMs >= ORACLE_ANCIENT_MS) return input.ancient;
    return formatRelAge(input.tsMs, input.locale, now);
  }
  if (input.height != null && input.tipHeight != null) {
    const blocks = Math.max(0, Math.floor(input.tipHeight) - Math.floor(input.height));
    if (blocks * ORACLE_BLOCK_MS_FALLBACK >= ORACLE_ANCIENT_MS) return input.ancient;
    return `#${input.height.toLocaleString(input.locale === "ru" ? "ru-RU" : "en-US")}`;
  }
  return input.ancient;
}
