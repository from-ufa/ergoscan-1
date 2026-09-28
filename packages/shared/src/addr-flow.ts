/**
 * Address-tape kind from this address's net, not "appeared on both sides".
 * Intra = economically flat. Send+change is sent.
 * Not DEX: Spectrum is order tx then fill tx — kind is per-tx, not a swap label.
 * GET computes this. Not a column. Distinct from transactions.shape.
 */

export const ADDR_FLOW_RULES_VERSION = 2;

export type AddrFlowKind = "sent" | "received" | "intra";

const ADDR_FLOW_KIND_SET: ReadonlySet<string> = new Set([
  "sent",
  "received",
  "intra",
]);

export function asAddrFlowKind(s: unknown): AddrFlowKind | null {
  if (typeof s !== "string" || !ADDR_FLOW_KIND_SET.has(s)) return null;
  return s as AddrFlowKind;
}

export function parseNanoErg(v: unknown): bigint {
  if (v == null) return 0n;
  if (typeof v === "bigint") return v;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return 0n;
    return BigInt(Math.trunc(v));
  }
  if (typeof v !== "string") return 0n;
  const s = String(v).trim();
  if (!s) return 0n;
  try {
    if (/[eE]/.test(s)) {
      const n = Number(s);
      if (!Number.isFinite(n)) return 0n;
      return BigInt(Math.trunc(n));
    }
    const intPart = s.split(".")[0] ?? "0";
    if (!/^-?\d+$/.test(intPart)) return 0n;
    return BigInt(intPart);
  } catch {
    return 0n;
  }
}

export type AddrFlowTokenNet = {
  amount: bigint;
  /** EIP-4 mint in this tx (tokenId = issuing box id). Subtracted only when net ERG is −fee. */
  mint?: bigint;
};

export type ClassifyAddrFlowInput = {
  /** outputs − inputs for this address, nanoERG */
  netErg: bigint;
  /** tx fee, nanoERG. 0 = unknown (consolidation then looks like sent). */
  fee: bigint;
  tokens?: Iterable<AddrFlowTokenNet>;
};

/**
 * Intra = net ERG is 0 or exactly −fee, and no directional token move.
 * Mint to self while paying fee is not "received".
 * When ERG moves, kind follows ERG; tokens stay on the peek line.
 * Do not label swap: Spectrum CFMM is two txs (order then fill).
 */
export function classifyAddrFlow(input: ClassifyAddrFlowInput): AddrFlowKind {
  const fee = input.fee < 0n ? 0n : input.fee;
  const paysFee = fee > 0n && input.netErg === -fee;
  const ergNeutral = input.netErg === 0n || paysFee;

  if (!ergNeutral) return input.netErg > 0n ? "received" : "sent";

  let tokPos = false;
  let tokNeg = false;
  for (const token of input.tokens ?? []) {
    let qty = token.amount;
    if (paysFee) qty -= token.mint ?? 0n;
    if (qty > 0n) tokPos = true;
    else if (qty < 0n) tokNeg = true;
  }
  if (tokNeg) return "sent";
  if (tokPos) return "received";
  return "intra";
}

export type Eip4MintBox = {
  boxId?: string | null;
  assets?: Array<{
    tokenId?: string | null;
    amount?: unknown;
  }>;
};

/** Ergo EIP-4: token id is the box id of the issuing output. */
export function eip4MintOfOutputs(outputs: Eip4MintBox[]): Map<string, bigint> {
  const mint = new Map<string, bigint>();
  for (const box of outputs) {
    const boxId = box.boxId?.toLowerCase();
    if (!boxId) continue;
    for (const asset of box.assets ?? []) {
      const tokenId = asset.tokenId?.toLowerCase();
      if (!tokenId || tokenId !== boxId) continue;
      const amt = parseNanoErg(asset.amount);
      if (amt <= 0n) continue;
      mint.set(tokenId, (mint.get(tokenId) ?? 0n) + amt);
    }
  }
  return mint;
}
