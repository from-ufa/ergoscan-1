/**
 * Dexy buyback boxes (GORT / DORT). Pure assembly over index rows.
 * The route reads the buyback NFT from packed.box_assets. No node.
 */

export type BuybackKind = "gort" | "dort";
export type MoveKind = "topup" | "swap" | "return" | "open";

export type RawBox = {
  id: string;
  nft: bigint;
  height: number;
  spentHeight: number | null;
  spentTx: string | null;
  creationTx: string;
  erg: bigint;
  reward: bigint;
};

export type BuybackMove = {
  height: number;
  kind: MoveKind;
  derg: bigint;
  dtok: bigint;
  erg: bigint;
  token: bigint;
  tx: string;
};

const INITIAL_DEX_GOLD = 10_000_000_000_000n;

export const BUYBACK = {
  gort: {
    kind: "gort" as const,
    slug: "xau-erg" as const,
    symbol: "GORT",
    tokenId: "7ba2a85fdb302a181578b1f64cb4a533d89b3f8de4159efece75da41041537f9",
    nftId: "610735cbf197f9de67b3628129feaa5a52403286859d140be719467c0fb94328",
    lpNft: "d1c9e20657b4e37de3cd279a994266db34b18e6e786371832ad014fd46583198",
    /** Compiled into buyback.es. The live gold pool posts a newer oracle token. */
    scriptOracleToken: "6183680b1c4caaf8ede8c60dc5128e38417bc5b656321388b22baa43a9d150c2",
    bankNft: "75d7bfbfa6d165bfda1bad3e3fda891e67ccdcfc7b4410c1790923de2ccc9f7f",
    bankToken: "6122f7289e7bb2df2de273e09d4b2756cda6aeb0f40438dc9d257688f45183ad",
    emissionNft: "bb484bb7fea08b15861e27cb203a13069082befb05f5437cae71237d9c5c6ac3",
  },
  dort: {
    kind: "dort" as const,
    slug: "erg-usd" as const,
    symbol: "DORT",
    tokenId: "ae399fcb751e8e247d0da8179a2bcca2aa5119fff9c85721ffab9cdc9a3cb2dd",
    nftId: "dcce07af04ea4f9b7979336476594dc16321547bcc9c6b95a67cb1a94192da4f",
    lpNft: "35bc71897cd44d1a624285c54a0be66b69d1c61674603ed89dfe136f32035f0e",
    scriptOracleToken: "74fa4aee3607ceb7bdefd51a856861b5dbfa434a8f6c93bfe967de8ed1a30a78",
    bankNft: null,
    bankToken: null,
    emissionNft: null,
  },
} as const;

export type BuybackDef = (typeof BUYBACK)[BuybackKind];

export function buybackBySlug(slug: string): BuybackDef | null {
  if (slug === BUYBACK.gort.slug) return BUYBACK.gort;
  if (slug === BUYBACK.dort.slug) return BUYBACK.dort;
  return null;
}

export function moveKind(derg: bigint, dtok: bigint): MoveKind {
  if (dtok > 0n && derg < 0n) return "swap";
  if (dtok === 0n && derg > 0n) return "topup";
  if (dtok < 0n && derg === 0n) return "return";
  return "open";
}

/** Spec pay for one refresh: 2×(N−1) when at least two operators posted. */
export function epochPay(live: number): number | null {
  if (!Number.isFinite(live) || live < 2) return null;
  return 2 * (live - 1);
}

/**
 * Gold bank cover. oracleRate is R4/10^6 nanoerg per DexyGold unit.
 * Payout in the contract opens only above 800% (liability × 8).
 */
export function goldCover(
  bankErg: bigint,
  bankTokens: bigint,
  r4: bigint
): { ratioBps: number; payoutOpen: boolean } | null {
  if (bankTokens < 0n || bankTokens > INITIAL_DEX_GOLD || r4 <= 0n || bankErg < 0n) return null;
  const circ = INITIAL_DEX_GOLD - bankTokens;
  if (circ <= 0n) return null;
  const rate = r4 / 1_000_000n;
  if (rate <= 0n) return null;
  const liability = rate * circ;
  if (liability <= 0n) return null;
  return {
    ratioBps: Number((bankErg * 10_000n) / liability),
    payoutOpen: liability * 8n < bankErg,
  };
}

export function downsample<T>(rows: T[], max: number): T[] {
  if (max < 2 || rows.length <= max) return rows.slice();
  const out: T[] = [];
  const step = (rows.length - 1) / (max - 1);
  let last = -1;
  for (let i = 0; i < max; i++) {
    const idx = Math.round(i * step);
    if (idx === last || idx < 0 || idx >= rows.length) continue;
    last = idx;
    const row = rows[idx];
    if (row !== undefined) out.push(row);
  }
  return out;
}

export function assembleBuyback(rows: RawBox[]): {
  live: RawBox | null;
  spare: bigint;
  moves: BuybackMove[];
} {
  const unspent = rows.filter((r) => r.spentHeight == null);
  const liveCandidates = unspent.filter((r) => r.nft === 1n && r.reward >= 1n);
  liveCandidates.sort((a, b) => {
    if (a.reward !== b.reward) return a.reward > b.reward ? -1 : 1;
    return b.height - a.height;
  });
  const live = liveCandidates[0] ?? null;

  let spare = 0n;
  for (const r of unspent) {
    if (live && r.id === live.id) continue;
    spare += r.nft;
  }

  const born = new Map<string, RawBox[]>();
  for (const r of rows) {
    if (r.nft !== 1n || !r.creationTx) continue;
    const list = born.get(r.creationTx);
    if (list) list.push(r);
    else born.set(r.creationTx, [r]);
  }

  const moves: BuybackMove[] = [];
  for (const r of rows) {
    if (r.nft !== 1n || !r.spentTx || r.spentHeight == null) continue;
    const kids = (born.get(r.spentTx) ?? []).filter((k) => k.id !== r.id);
    if (kids.length !== 1) continue;
    const out = kids[0];
    if (!out) continue;
    const derg = out.erg - r.erg;
    const dtok = out.reward - r.reward;
    moves.push({
      height: r.spentHeight,
      kind: moveKind(derg, dtok),
      derg,
      dtok,
      erg: out.erg,
      token: out.reward,
      tx: r.spentTx,
    });
  }
  moves.sort((a, b) => a.height - b.height || (a.tx < b.tx ? -1 : a.tx > b.tx ? 1 : 0));
  return { live, spare, moves };
}
