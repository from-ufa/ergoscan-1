import type { RentRailPip } from "@ergoscan/shared";
import { RENT_CRATE_INK } from "./palette";

export const RENT_SLOT = 32;
export const RENT_CRATE = 32;
export const RENT_MINER = 32;
export const RENT_STACK = 8;
export const RENT_FLOOR = 4;
export const RENT_CRATE_PX = { s: 20, m: 26, l: 32 } as const;

export type CrateBulk = keyof typeof RENT_CRATE_PX;

/** S / M / L by boxes on that address — not by rent ERG. */
export function crateBulk(boxCount: number): CrateBulk {
  if (boxCount >= 4) return "l";
  if (boxCount >= 2) return "m";
  return "s";
}

function rentAmount(nano: string): bigint {
  const raw = String(nano ?? "0").trim().split(".")[0] ?? "0";
  if (!/^-?\d+$/.test(raw)) return 0n;
  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
}

/** Six rent steps, unique amounts spread small → large. Zero is the first ink. */
export function rentTone(nano: string, packNanos: readonly string[]): number {
  const last = RENT_CRATE_INK.length - 1;
  const v = rentAmount(nano);
  const unique = [
    ...new Set(packNanos.map(rentAmount).filter((n) => n > 0n)),
  ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (v <= 0n || !unique.length) return 0;
  const idx = unique.findIndex((n) => n === v);
  const i = idx >= 0 ? idx : v >= unique[unique.length - 1]! ? unique.length - 1 : 0;
  if (unique.length === 1) return last;
  return Math.round((i * last) / (unique.length - 1));
}

export function rentToneInk(nano: string, packNanos: readonly string[]): string {
  return RENT_CRATE_INK[rentTone(nano, packNanos)] ?? RENT_CRATE_INK[0];
}
export const RENT_ON_LIFT = 20;
/** Step off a crate before walking to a hover target. */
export const RENT_STEP_OFF_MS = 440;
export const RENT_SWING_MS = 720;
export const RENT_HOVER_SWING_MS = 480;
/** Ghost crate after an address drops off the tape (tip snapshot). */
export const RENT_TAKEN_MS = 720;
/** New crate drops onto the dock. */
export const RENT_ENTER_MS = 640;
/** Preview yard: hold one crate back so taken + enter can replay. */
export const RENT_DEMO_MS = 4200;

/** Swap one slot with the held-back row on odd ticks — other crates stay put. */
export function rentYardDemoPack<T>(rows: readonly T[], tick: number): T[] {
  if (rows.length < 2) return [...rows];
  const keep = rows.slice(0, -1);
  const extra = rows[rows.length - 1]!;
  if (tick <= 0 || tick % 2 === 0) return keep;
  const slot = Math.floor((tick - 1) / 2) % keep.length;
  return keep.map((row, i) => (i === slot ? extra : row));
}

export type CrateStation = {
  t: number;
  y: number;
  stack0: number;
  stackN: number;
  addresses: string[];
};

export const RENT_IDLE_STATION: CrateStation = {
  t: 0,
  y: 0,
  stack0: 0,
  stackN: 0,
  addresses: [],
};

export type PoseKind = "before" | "on" | "after";
export type PatrolPhase = "approach" | "on" | "leave";
export type PatrolDir = 1 | -1;

export type PatrolCursor = {
  i: number;
  dir: PatrolDir;
  phase: PatrolPhase;
  prevT: number;
  prevY: number;
};

export type PatrolStep = PatrolCursor & {
  gait: "walk" | "swing";
  ms: number;
  after: PatrolCursor;
};

/** Keep probe / S-path order. Do not sort by t — that flattens the climb. */
export function crateStations(pips: readonly RentRailPip[]): CrateStation[] {
  const groups: CrateStation[] = [];
  for (const p of pips) {
    const y = p.y ?? 0;
    const last = groups[groups.length - 1];
    if (last && last.t === p.t && last.y === y) {
      last.stackN = p.stack;
      last.addresses.push(p.address);
    } else {
      groups.push({ t: p.t, y, stack0: p.stack, stackN: p.stack, addresses: [p.address] });
    }
  }
  return groups;
}

export function poseKind(dir: PatrolDir, phase: PatrolPhase): PoseKind {
  if (phase === "on") return "on";
  if (dir === 1) return phase === "approach" ? "before" : "after";
  return phase === "approach" ? "after" : "before";
}

export function nextPatrol(
  i: number,
  dir: PatrolDir,
  phase: PatrolPhase,
  n: number
): { i: number; dir: PatrolDir; phase: PatrolPhase } {
  if (n <= 0) return { i: 0, dir, phase };
  if (phase === "approach") return { i, dir, phase: "on" };
  if (phase === "on") return { i, dir, phase: "leave" };
  const nxt = i + dir;
  if (nxt < 0 || nxt >= n) return { i, dir: dir === 1 ? -1 : 1, phase: "approach" };
  return { i: nxt, dir, phase: "approach" };
}

/** Keep the current crate if it still exists; otherwise follow one of its addresses. */
export function remapStationIndex(
  live: readonly CrateStation[],
  had: readonly string[],
  i: number
): number {
  if (!live.length) return 0;
  if (i >= 0 && i < live.length) {
    const st = live[i]!;
    if (!had.length || had.some((a) => st.addresses.includes(a))) return i;
  }
  for (const a of had) {
    const j = live.findIndex((s) => s.addresses.includes(a));
    if (j >= 0) return j;
  }
  return Math.min(Math.max(0, i), live.length - 1);
}

/** Hit-slot left so the crate center sits on aisle `t`. */
export function crateSlotLeft(t: number): string {
  return `calc(${t} * 100% - ${RENT_SLOT / 2}px)`;
}

/** Crate / dock bottom on the yard. `y` is 0–1 up the stage. */
export function crateTerraceBottom(y: number): string {
  return `calc(${y} * (100% - ${RENT_CRATE + 18}px) + ${RENT_FLOOR}px)`;
}

export function minerIdlePose(): { left: string; bottom: string; zIndex: number } {
  return { left: "8px", bottom: `${RENT_FLOOR}px`, zIndex: 22 };
}

export function minerZ(y: number): number {
  if (y >= 0.58) return 4;
  if (y >= 0.28) return 10;
  return 22;
}

export function minerPose(
  kind: PoseKind,
  st: CrateStation
): { left: string; bottom: string; zIndex: number } {
  const y = st.y ?? 0;
  const extra = kind === "on" ? RENT_ON_LIFT : 0;
  const bottom = `calc(${y} * (100% - ${RENT_MINER + 20}px) + ${RENT_FLOOR + extra}px)`;
  const zIndex = minerZ(y);
  if (kind === "before") {
    return {
      left: `max(0px, calc(${st.t} * 100% - ${RENT_SLOT / 2 + RENT_MINER + 2}px))`,
      bottom,
      zIndex,
    };
  }
  if (kind === "on") {
    return {
      left: `calc(${st.t} * 100% - ${RENT_MINER / 2}px)`,
      bottom,
      zIndex,
    };
  }
  return {
    left: `min(calc(100% - ${RENT_MINER}px), calc(${st.t} * 100% + ${RENT_SLOT / 2 + 2}px))`,
    bottom,
    zIndex,
  };
}

export function isClimb(fromY: number, toY: number): boolean {
  return Math.abs(toY - fromY) > 0.25;
}

export function patrolMs(
  fromT: number,
  toT: number,
  fromY: number,
  toY: number,
  sameStation: boolean
): number {
  if (sameStation) return 760;
  const d = Math.hypot(toT - fromT, (toY - fromY) * 1.2);
  return Math.min(2200, Math.max(840, Math.round(760 + d * 1560)));
}

function walkTo(
  live: readonly CrateStation[],
  i: number,
  dir: PatrolDir,
  prevT: number,
  prevY: number
): PatrolStep {
  const st = live[i]!;
  const same = Math.abs(prevT - st.t) < 0.001 && Math.abs(prevY - st.y) < 0.001;
  const ms = patrolMs(prevT, st.t, prevY, st.y, same);
  const cursor: PatrolCursor = { i, dir, phase: "approach", prevT: st.t, prevY: st.y };
  return {
    ...cursor,
    gait: "walk",
    ms,
    after: { i, dir, phase: "on", prevT: st.t, prevY: st.y },
  };
}

/**
 * One pose + duration. `after` is the cursor when the timer fires.
 * Hover retargets immediately: step off if standing, else walk; never skip an in-flight approach.
 */
export function planPatrolStep(
  live: readonly CrateStation[],
  cur: PatrolCursor,
  hotAddr: string | null
): PatrolStep | null {
  if (!live.length) return null;
  const n = live.length;
  const i = Math.min(Math.max(0, cur.i), n - 1);
  const dir = cur.dir;
  const phase = cur.phase;
  const prevT = cur.prevT;
  const prevY = cur.prevY ?? 0;
  const hi = hotAddr ? live.findIndex((s) => s.addresses.includes(hotAddr)) : -1;

  if (hi >= 0) {
    if (i !== hi) {
      const toward: PatrolDir = hi > i ? 1 : -1;
      if (phase === "on") {
        const st = live[i]!;
        return {
          i,
          dir: toward,
          phase: "leave",
          prevT: st.t,
          prevY: st.y,
          gait: "walk",
          ms: RENT_STEP_OFF_MS,
          after: { i: hi, dir: toward, phase: "approach", prevT: st.t, prevY: st.y },
        };
      }
      return walkTo(live, hi, toward, prevT, prevY);
    }
    if (phase === "approach") {
      return walkTo(live, i, dir, prevT, prevY);
    }
    const st = live[i]!;
    return {
      i,
      dir,
      phase: "on",
      prevT: st.t,
      prevY: st.y,
      gait: "swing",
      ms: RENT_HOVER_SWING_MS,
      after: { i, dir, phase: "on", prevT: st.t, prevY: st.y },
    };
  }

  if (phase === "on") {
    const st = live[i]!;
    const nxt = nextPatrol(i, dir, "on", n);
    return {
      i,
      dir,
      phase: "on",
      prevT: st.t,
      prevY: st.y,
      gait: "swing",
      ms: RENT_SWING_MS,
      after: { i: nxt.i, dir: nxt.dir, phase: nxt.phase, prevT: st.t, prevY: st.y },
    };
  }

  const st = live[i]!;
  const same = Math.abs(prevT - st.t) < 0.001 && Math.abs(prevY - st.y) < 0.001;
  const ms = patrolMs(prevT, st.t, prevY, st.y, same);
  const nxt = nextPatrol(i, dir, phase, n);
  return {
    i,
    dir,
    phase,
    prevT: st.t,
    prevY: st.y,
    gait: "walk",
    ms,
    after: { i: nxt.i, dir: nxt.dir, phase: nxt.phase, prevT: st.t, prevY: st.y },
  };
}
