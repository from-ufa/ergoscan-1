/** Five Ergo holder classes. Thresholds in nanoERG, hi exclusive. */

export const HOLDER_BAND_IDS = ["dust", "stacker", "believer", "guardian", "overlord"] as const;

export type HolderBandId = (typeof HOLDER_BAND_IDS)[number];

export type HolderBandRow = {
  id: HolderBandId;
  n: number;
  nanoerg: string;
};

/** <100 · 100–1k · 1k–10k · 10k–100k · ≥100k ERG */
const CEIL: Record<HolderBandId, bigint | null> = {
  dust: 100_000_000_000n,
  stacker: 1_000_000_000_000n,
  believer: 10_000_000_000_000n,
  guardian: 100_000_000_000_000n,
  overlord: null,
};

export function bandFromNano(nano: string | number | bigint | null | undefined): HolderBandId {
  let n = 0n;
  try {
    if (typeof nano === "bigint") n = nano < 0n ? 0n : nano;
    else if (typeof nano === "number") n = Number.isFinite(nano) && nano > 0 ? BigInt(Math.trunc(nano)) : 0n;
    else {
      const s = String(nano ?? "0").trim().split(".")[0] ?? "0";
      n = /^-?\d+$/.test(s) ? BigInt(s) : 0n;
      if (n < 0n) n = 0n;
    }
  } catch {
    n = 0n;
  }
  for (const id of HOLDER_BAND_IDS) {
    const hi = CEIL[id];
    if (hi == null || n < hi) return id;
  }
  return "overlord";
}

export function emptyBands(): HolderBandRow[] {
  return HOLDER_BAND_IDS.map((id) => ({ id, n: 0, nanoerg: "0" }));
}

export function bandCount(raw: unknown): number {
  return mergeBands(raw).reduce((n, row) => n + row.n, 0);
}

export function mergeBands(raw: unknown): HolderBandRow[] {
  const byId = new Map<string, { n: number; nanoerg: string }>();
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      const rec = row as { id?: unknown; n?: unknown; nanoerg?: unknown };
      const id = String(rec.id ?? "");
      if (!HOLDER_BAND_IDS.includes(id as HolderBandId)) continue;
      const n = Number(rec.n);
      byId.set(id, {
        n: Number.isFinite(n) && n > 0 ? Math.round(n) : 0,
        nanoerg: String(rec.nanoerg ?? "0"),
      });
    }
  }
  return HOLDER_BAND_IDS.map((id) => ({
    id,
    n: byId.get(id)?.n ?? 0,
    nanoerg: byId.get(id)?.nanoerg ?? "0",
  }));
}
