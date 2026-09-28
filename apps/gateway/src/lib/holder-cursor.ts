/** Holder tape cursor: `amount|address` (amount is NUMERIC text). */

export type HolderCursor = { amount: string; address: string };

export function encodeHolderCursor(amount: string, address: string): string {
  return `${amount}|${address}`;
}

export function parseHolderCursor(raw: unknown): HolderCursor | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const i = s.indexOf("|");
  if (i < 1) return null;
  const amount = s.slice(0, i);
  const address = s.slice(i + 1);
  if (!address || !/^-?\d+(\.\d+)?$/.test(amount)) return null;
  return { amount, address };
}
