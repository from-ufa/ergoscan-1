/**
 * Stage Flow — retention physics profiles (pure data).
 * Visual engine used to live in the web canvas; keep the tables here.
 */
import type { TxCategory } from "./types.js";

export type SpawnPlan = {
  lane: number;
  x: number;
  vx: number;
  density: number;
  restitution: number;
  gravity: number;
};

const PROFILES: Record<
  TxCategory,
  { lane: number; density: number; restitution: number; gravity: number; vx: number }
> = {
  transfer: { lane: 0, density: 1, restitution: 0.35, gravity: 1, vx: 0 },
  token: { lane: 1, density: 0.9, restitution: 0.55, gravity: 0.95, vx: 0.12 },
  nft: { lane: -1, density: 0.45, restitution: 0.4, gravity: 0.55, vx: -0.08 },
  defi: { lane: -0.5, density: 1.4, restitution: 0.22, gravity: 1.25, vx: -0.04 },
  bridge: { lane: -1.4, density: 1, restitution: 0.3, gravity: 0.9, vx: -0.22 },
  mixer: { lane: 1.4, density: 0.8, restitution: 0.8, gravity: 0.85, vx: 0.18 },
  oracle: { lane: 0, density: 0.7, restitution: 0.28, gravity: 0.8, vx: 0 },
  agent: { lane: 0.6, density: 0.85, restitution: 0.45, gravity: 0.9, vx: 0.1 },
  stable: { lane: -0.3, density: 1.1, restitution: 0.12, gravity: 1.05, vx: 0 },
  unknown: { lane: 0.2, density: 1, restitution: 0.3, gravity: 1, vx: 0 },
  contract: { lane: 0.4, density: 1.15, restitution: 0.25, gravity: 1.1, vx: 0.05 },
  coinbase: { lane: 0, density: 1.2, restitution: 0.18, gravity: 1.15, vx: 0 },
  "fee-collect": { lane: 0, density: 1.15, restitution: 0.2, gravity: 1.12, vx: 0 },
  "reward-unlock": { lane: 0.05, density: 1.05, restitution: 0.24, gravity: 1.08, vx: 0.01 },
  "script-pay": { lane: 0.15, density: 1, restitution: 0.32, gravity: 1, vx: 0.02 },
};

export function planSpawn(category: TxCategory, feeRate = 0): SpawnPlan {
  const p = PROFILES[category] ?? PROFILES.unknown;
  const turbo = Math.min(2, 1 + feeRate / 20_000);
  return {
    lane: p.lane,
    x: 0.5 + p.lane * 0.12,
    vx: p.vx * turbo,
    density: p.density,
    restitution: p.restitution,
    gravity: p.gravity * turbo,
  };
}

export type ScoreEvent =
  | "spawn"
  | "land"
  | "collision"
  | "click"
  | "ripple"
  | "seal";

export function scoreForEvent(event: ScoreEvent, weight = 1, combo = 1): number {
  const base =
    event === "spawn"
      ? 10
      : event === "land"
        ? 25
        : event === "collision"
          ? 2
          : event === "click"
            ? 50
            : event === "ripple"
              ? 5
              : 500;
  return Math.round(base * weight * Math.max(1, combo));
}
