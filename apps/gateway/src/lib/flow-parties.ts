import { MINERS_FEE_ADDRESS } from "@ergoscan/shared";

/** Cap counterparties on the token tx tape. Pack only, not a table scan. */
export const FLOW_PARTY_CAP = 8;

export function flowParties(
  inputs: { address: string | null | undefined }[],
  outputs: { address: string | null | undefined }[]
): { from: string[]; to: string[] } {
  return {
    from: uniqAddrs(inputs, false),
    to: uniqAddrs(outputs, true),
  };
}

/** One token-box leg (input spend or output create). Amounts are raw token units. */
export type TokenLeg = { address: string; amount: bigint };

/** Parallel address/amount arrays from `array_agg` on the pack (not DISTINCT). */
export function zipTokenLegs(addrs: unknown, amts: unknown): TokenLeg[] {
  const a = pgTextArray(addrs);
  const q = pgTextArray(amts);
  const n = Math.min(a.length, q.length);
  const out: TokenLeg[] = [];
  for (let i = 0; i < n; i++) {
    const address = a[i]?.trim() ?? "";
    if (!address) continue;
    let amount = 0n;
    try {
      amount = BigInt((q[i] ?? "0").split(".")[0] ?? "0");
    } catch {
      amount = 0n;
    }
    if (amount === 0n) continue;
    out.push({ address, amount });
  }
  return out;
}

/**
 * A token *move* is a non-zero net of this token per address
 * (outputs − inputs). Change / self-shuffle (net 0) is omitted, so A→A
 * does not appear. `moved` = sum of positive nets (tokens that changed hands).
 * ergoexplorer recentTransfers = newest *output boxes* (`to` + amount, no from).
 */
export function netTokenParties(
  spent: TokenLeg[],
  created: TokenLeg[]
): { from: string[]; to: string[]; moved: string } {
  const net = new Map<string, bigint>();
  const add = (address: string, delta: bigint) => {
    const a = address.trim();
    if (!a) return;
    net.set(a, (net.get(a) ?? 0n) + delta);
  };
  for (const r of spent) add(r.address, -r.amount);
  for (const r of created) add(r.address, r.amount);

  const from: string[] = [];
  const to: string[] = [];
  let moved = 0n;
  for (const [address, n] of net) {
    if (n < 0n) {
      if (from.length < FLOW_PARTY_CAP) from.push(address);
    } else if (n > 0n) {
      if (address === MINERS_FEE_ADDRESS) continue;
      if (to.length < FLOW_PARTY_CAP) to.push(address);
      moved += n;
    }
  }
  return { from, to, moved: moved.toString() };
}

function pgTextArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((a): a is string => typeof a === "string" && a.length > 0);
}

function uniqAddrs(
  rows: { address: string | null | undefined }[],
  skipFee: boolean
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const a = typeof r.address === "string" ? r.address.trim() : "";
    if (!a || seen.has(a)) continue;
    if (skipFee && a === MINERS_FEE_ADDRESS) continue;
    seen.add(a);
    out.push(a);
    if (out.length >= FLOW_PARTY_CAP) break;
  }
  return out;
}
