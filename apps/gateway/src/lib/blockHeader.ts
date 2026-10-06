/** Signing fields stored on packed.blocks. Absent until that height is filled. */

export type BlockHeaderView = {
  version: number | null;
  nBits: string | null;
  votes: number[];
  difficulty: string | null;
  stateRoot: string;
  adProofsRoot: string;
  transactionsRoot: string;
  extensionHash: string;
  powPk: string | null;
  powW: string | null;
  powN: string | null;
  powD: string | null;
};

function hexField(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (!s || !/^[0-9a-f]+$/.test(s) || s.length % 2 !== 0) return null;
  return s;
}

function digitField(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  return /^-?\d+$/.test(s) ? s : null;
}

export function votesFromHex(hex: string | null): number[] {
  if (!hex) return [];
  const out: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    out.push(Number.parseInt(hex.slice(i, i + 2), 16));
  }
  return out;
}

export function blockHeaderFromRow(row: {
  version?: unknown;
  nBits?: unknown;
  votes?: unknown;
  difficulty?: unknown;
  stateRoot?: unknown;
  adProofsRoot?: unknown;
  transactionsRoot?: unknown;
  extensionHash?: unknown;
  powPk?: unknown;
  powW?: unknown;
  powN?: unknown;
  powD?: unknown;
}): BlockHeaderView | null {
  const stateRoot = hexField(row.stateRoot);
  if (!stateRoot) return null;
  const version = row.version == null || row.version === "" ? null : Number(row.version);
  return {
    version: version != null && Number.isInteger(version) ? version : null,
    nBits: digitField(row.nBits),
    votes: votesFromHex(hexField(row.votes)),
    difficulty: digitField(row.difficulty),
    stateRoot,
    adProofsRoot: hexField(row.adProofsRoot) ?? "",
    transactionsRoot: hexField(row.transactionsRoot) ?? "",
    extensionHash: hexField(row.extensionHash) ?? "",
    powPk: hexField(row.powPk),
    powW: hexField(row.powW),
    powN: hexField(row.powN),
    powD: digitField(row.powD),
  };
}
