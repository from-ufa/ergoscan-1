import { oracleOperatorFromRegisters } from "./oracle-pools.js";

/** One box on either side of a refresh transaction. */
export type LeaderBox = {
  /** Spent by the refresh. An output is false. */
  spent: boolean;
  value: bigint;
  /** Operator address. For a seat this is R4, not the script address. */
  address: string | null;
  seat: boolean;
};

/** Person who paid the refresh. Seat surplus wins over a wallet input. */
export function pickLeader(boxes: LeaderBox[]): string | null {
  return bestPayer(boxes.filter((b) => b.seat)) ?? bestPayer(boxes.filter((b) => !b.seat));
}

export function leaderAddressFromR4(r4: string | null | undefined): string | null {
  if (!r4) return null;
  return oracleOperatorFromRegisters({ R4: r4 }).address;
}

function bestPayer(boxes: LeaderBox[]): string | null {
  const delta = new Map<string, bigint>();
  for (const box of boxes) {
    const address = box.address;
    if (!address || !address.startsWith("9")) continue;
    const next = (delta.get(address) ?? 0n) + (box.spent ? box.value : -box.value);
    delta.set(address, next);
  }
  let winner: string | null = null;
  let best = 0n;
  for (const [address, paid] of delta) {
    if (paid > best) {
      best = paid;
      winner = address;
    }
  }
  return winner;
}
