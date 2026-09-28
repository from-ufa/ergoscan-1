/**
 * Deterministic seed when an ordering block seals — Stage canvas climax.
 */

export type SealEvent = {
  blockId: string;
  height: number;
  timestamp: number;
  txIds: string[];
  replaySeed: string;
  size?: number;
  txCount: number;
};

/** Stable string from header id + height (not a cryptographic hash). */
export function replaySeed(blockId: string, height: number): string {
  let h = 2166136261;
  const s = `${blockId}:${height}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `s${(h >>> 0).toString(16)}:${height}`;
}
