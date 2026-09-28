import { lookupAddress } from "@/lib/address-book";
import { DONUT_SLICES } from "@/lib/palette";

/** Visible rows in the /rent collector list. The rest scroll. */
export const RENT_POOL_VISIBLE = 5;
export const RENT_POOL_ROW_CLASS = "h-10";

export type RentMinerPeriod = "day" | "month" | "all";

export type RentMinerPoolIn = {
  address: string;
  name: string;
  boxCount: number;
  rentNano: string;
  share: number;
};

export type RentMinersPack = {
  boxCount?: number;
  rentNano?: string;
  coveredBoxes: number;
  coveredRentNano: string;
  uncoveredBoxes: number;
  uncoveredRentNano: string;
  /** Distinct collectors. `pools` is only the largest slice shown in the list. */
  claimerCount?: number;
  pools: RentMinerPoolIn[];
};

export type RentMinerRow = {
  id: string;
  name: string;
  address: string | null;
  addresses: string[];
  boxCount: number;
  rentNano: string;
  share: number;
  kind: "pool" | "uncovered";
  ink: string;
};

export const RENT_UNCOVERED_INK = DONUT_SLICES[DONUT_SLICES.length - 1] ?? "rgba(255,255,255,0.28)";
const POOL_INKS = DONUT_SLICES.filter((c) => c !== RENT_UNCOVERED_INK);

function addNano(a: string, b: string): string {
  try {
    return (BigInt(a) + BigInt(b)).toString();
  } catch {
    return a;
  }
}

function cmpNanoDesc(a: string, b: string): number {
  try {
    const d = BigInt(b) - BigInt(a);
    return d > 0n ? 1 : d < 0n ? -1 : 0;
  } catch {
    return 0;
  }
}

export function rentShareOf(part: string, total: string): number {
  try {
    const t = BigInt(total);
    if (t <= 0n) return 0;
    return Number((BigInt(part) * 100_000n) / t) / 100_000;
  } catch {
    return 0;
  }
}

export function formatRentSharePct(share: number): string {
  if (!Number.isFinite(share) || share <= 0) return "0%";
  return `${Math.round(share * 100)}%`;
}

export function nameRentMinerPools(
  pools: readonly RentMinerPoolIn[]
): RentMinerPoolIn[] {
  return pools.map((row) => {
    const n = lookupAddress(row.address)?.name?.trim();
    return n ? { ...row, name: n } : row;
  });
}

export function rentMinerWindowTotal(
  miners: RentMinersPack | null | undefined,
  fallback = "0"
): string {
  if (!miners) return fallback;
  const direct = miners.rentNano;
  if (direct) {
    try {
      if (BigInt(direct) > 0n) return direct;
    } catch {
      /* */
    }
  }
  try {
    return (
      BigInt(miners.coveredRentNano || "0") + BigInt(miners.uncoveredRentNano || "0")
    ).toString();
  } catch {
    return fallback;
  }
}

export function rentMinerPeriodsReady(collected: {
  minersDay?: RentMinersPack | null;
  minersMonth?: RentMinersPack | null;
}): boolean {
  return collected.minersDay != null || collected.minersMonth != null;
}

export function pickRentMinerPeriod(
  collected: {
    rentNano: string;
    miners?: RentMinersPack | null;
    minersDay?: RentMinersPack | null;
    minersMonth?: RentMinersPack | null;
  },
  period: RentMinerPeriod
): { miners: RentMinersPack; totalRentNano: string; period: RentMinerPeriod } {
  if (period === "day" && collected.minersDay) {
    return {
      miners: collected.minersDay,
      totalRentNano: rentMinerWindowTotal(collected.minersDay, "0"),
      period: "day",
    };
  }
  if (period === "month" && collected.minersMonth) {
    return {
      miners: collected.minersMonth,
      totalRentNano: rentMinerWindowTotal(collected.minersMonth, "0"),
      period: "month",
    };
  }
  return {
    miners: collected.miners ?? {
      coveredBoxes: 0,
      coveredRentNano: "0",
      uncoveredBoxes: 0,
      uncoveredRentNano: "0",
      pools: [],
    },
    totalRentNano: collected.rentNano,
    period: "all",
  };
}

export function hasRentMinerRows(
  miners:
    | {
        pools?: readonly RentMinerPoolIn[] | null;
        uncoveredBoxes?: number;
        uncoveredRentNano?: string;
      }
    | null
    | undefined
): boolean {
  if (!miners) return false;
  if ((miners.pools?.length ?? 0) > 0) return true;
  if ((miners.uncoveredBoxes ?? 0) > 0) return true;
  try {
    return BigInt(miners.uncoveredRentNano || "0") > 0n;
  } catch {
    return false;
  }
}

/** Merge same pool name (two Hero Miners 88…, two 2miners). Uncovered stays last, not a pool. */
export function mergeRentMinerPools(
  pools: readonly RentMinerPoolIn[],
  uncovered: { boxes: number; rentNano: string },
  totalRentNano: string
): RentMinerRow[] {
  const byName = new Map<
    string,
    { name: string; boxCount: number; rentNano: string; addresses: { address: string; rentNano: string }[] }
  >();
  for (const row of pools) {
    const address = typeof row.address === "string" ? row.address.trim() : "";
    const name = (typeof row.name === "string" && row.name.trim() ? row.name.trim() : address) || "—";
    if (!address && name === "—") continue;
    const cur = byName.get(name) ?? { name, boxCount: 0, rentNano: "0", addresses: [] };
    cur.boxCount += Number(row.boxCount) || 0;
    cur.rentNano = addNano(cur.rentNano, row.rentNano || "0");
    if (address) cur.addresses.push({ address, rentNano: row.rentNano || "0" });
    byName.set(name, cur);
  }
  const rows: RentMinerRow[] = [...byName.values()]
    .map((g) => {
      const addresses = [...g.addresses].sort((a, b) => cmpNanoDesc(a.rentNano, b.rentNano));
      return {
        id: g.name,
        name: g.name,
        address: addresses[0]?.address ?? null,
        addresses: addresses.map((a) => a.address),
        boxCount: g.boxCount,
        rentNano: g.rentNano,
        share: rentShareOf(g.rentNano, totalRentNano),
        kind: "pool" as const,
        ink: POOL_INKS[0] ?? DONUT_SLICES[0]!,
      };
    })
    .sort((a, b) => cmpNanoDesc(a.rentNano, b.rentNano) || a.name.localeCompare(b.name));
  rows.forEach((row, i) => {
    row.ink = POOL_INKS[i % POOL_INKS.length] ?? DONUT_SLICES[0]!;
  });
  let uncoveredNano = "0";
  try {
    uncoveredNano = BigInt(uncovered.rentNano || "0").toString();
  } catch {
    uncoveredNano = "0";
  }
  const uncoveredBoxes = Math.max(0, Number(uncovered.boxes) || 0);
  let uncoveredPos = 0n;
  try {
    uncoveredPos = BigInt(uncoveredNano);
  } catch {
    uncoveredPos = 0n;
  }
  if (uncoveredBoxes > 0 || uncoveredPos > 0n) {
    rows.push({
      id: "uncovered",
      name: "",
      address: null,
      addresses: [],
      boxCount: uncoveredBoxes,
      rentNano: uncoveredNano,
      share: rentShareOf(uncoveredNano, totalRentNano),
      kind: "uncovered",
      ink: RENT_UNCOVERED_INK,
    });
  }
  return rows;
}
