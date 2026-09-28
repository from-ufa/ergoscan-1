/** Home mempool pit — 2D cinema helpers. No GSAP; house cubic-bezier(0.4, 0, 0.2, 1). */

export const HOUSE_BEZIER = [0.4, 0, 0.2, 1] as const;
export const PIT_MIN_R = 9;
export const PIT_MAX_R = 36;
/** px radius at 1 KB (`r = k · √kb`). */
export const PIT_R_PER_SQRT_KB = 16.4;

export function radiusFromKb(bytes: number): number {
  const kb = Math.max(0.15, (Number.isFinite(bytes) ? Math.max(0, bytes) : 0) / 1024);
  return Math.min(PIT_MAX_R, Math.max(PIT_MIN_R, PIT_R_PER_SQRT_KB * Math.sqrt(kb)));
}

export function parseHex(color: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hexFill(color: string, a: number): string {
  const rgb = parseHex(color);
  if (!rgb) return color;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

/** Area-weighted sRGB mix — colliding txs become one ball. */
export function mixHex(parts: readonly { color: string; weight: number }[]): string {
  let r = 0;
  let g = 0;
  let b = 0;
  let w = 0;
  for (const p of parts) {
    const rgb = parseHex(p.color);
    const wt = p.weight > 0 && Number.isFinite(p.weight) ? p.weight : 0;
    if (!rgb || wt <= 0) continue;
    r += rgb[0] * wt;
    g += rgb[1] * wt;
    b += rgb[2] * wt;
    w += wt;
  }
  if (w <= 0) return "#64748B";
  const h = (n: number) => Math.round(n / w).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function bezier1d(t: number, a: number, b: number, c: number, d: number): number {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
}

/** Map unit time through cubic-bezier(x1,y1,x2,y2). */
export function cubicBezierEase(t: number, x1: number, y1: number, x2: number, y2: number): number {
  const x = Math.min(1, Math.max(0, t));
  let s = x;
  for (let i = 0; i < 8; i++) {
    const dx = bezier1d(s, 0, x1, x2, 1) - x;
    const d =
      3 * (1 - s) * (1 - s) * x1 +
      6 * (1 - s) * s * (x2 - x1) +
      3 * s * s * (1 - x2);
    if (Math.abs(d) < 1e-6) break;
    s = Math.min(1, Math.max(0, s - dx / d));
  }
  return bezier1d(s, 0, y1, y2, 1);
}

export function easeHouse(t: number): number {
  return cubicBezierEase(t, HOUSE_BEZIER[0], HOUSE_BEZIER[1], HOUSE_BEZIER[2], HOUSE_BEZIER[3]);
}

export type PitBody = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  size: number;
  category: string;
  platform: string | null;
  value: number;
  born: number;
  /** 0 teardrop at the ceiling → 1 circle in the pit. */
  morph: number;
  spin: number;
  sealing: boolean;
  leaving: number | null;
};

export const PIT_REST = 0.98;
export const PIT_MIN_SPEED = 34;
export const PIT_MAX_SPEED = 96;

export function collide(a: PitBody, b: PitBody) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const min = a.r + b.r;
  if (dist >= min) return;
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = min - dist;
  const ma = Math.max(1, a.r * a.r);
  const mb = Math.max(1, b.r * b.r);
  const sum = ma + mb;
  a.x -= nx * overlap * (mb / sum);
  a.y -= ny * overlap * (mb / sum);
  b.x += nx * overlap * (ma / sum);
  b.y += ny * overlap * (ma / sum);
  const rv = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (rv > 0) return;
  const j = (-(1 + PIT_REST) * rv) / (1 / ma + 1 / mb);
  a.vx += (j / ma) * nx;
  a.vy += (j / ma) * ny;
  b.vx -= (j / mb) * nx;
  b.vy -= (j / mb) * ny;
}

export function walls(b: PitBody, w: number, h: number) {
  const p = 2;
  if (b.x < b.r + p) {
    b.x = b.r + p;
    b.vx = Math.abs(b.vx) * PIT_REST;
  } else if (b.x > w - b.r - p) {
    b.x = w - b.r - p;
    b.vx = -Math.abs(b.vx) * PIT_REST;
  }
  if (b.y < b.r + p) {
    b.y = b.r + p;
    b.vy = Math.abs(b.vy) * PIT_REST;
  } else if (b.y > h - b.r - p) {
    b.y = h - b.r - p;
    b.vy = -Math.abs(b.vy) * PIT_REST;
  }
}

export function clampSpeed(b: PitBody) {
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > PIT_MAX_SPEED) {
    const s = PIT_MAX_SPEED / sp;
    b.vx *= s;
    b.vy *= s;
    return;
  }
  if (sp >= PIT_MIN_SPEED) return;
  if (sp < 0.05) {
    const ang = Number.isFinite(b.spin) ? b.spin : 0;
    b.vx = Math.cos(ang) * PIT_MIN_SPEED;
    b.vy = Math.sin(ang) * PIT_MIN_SPEED;
    return;
  }
  const s = PIT_MIN_SPEED / sp;
  b.vx *= s;
  b.vy *= s;
}

/** Cursor overlap — balls flinch away from the pointer. */
export function feelCursor(b: PitBody, mx: number, my: number, dt: number) {
  const dx = b.x - mx;
  const dy = b.y - my;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const reach = b.r + 16;
  if (dist > reach) return;
  const u = 1 - dist / reach;
  const f = 420 * u * u;
  b.vx += (dx / dist) * f * dt;
  b.vy += (dy / dist) * f * dt;
}

/** Click: flip the ball away from the pointer. */
export function pokeBall(b: PitBody, mx: number, my: number) {
  const dx = b.x - mx;
  const dy = b.y - my;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  const sp = Math.max(PIT_MIN_SPEED * 1.35, Math.hypot(b.vx, b.vy));
  b.vx = nx * sp * 1.25;
  b.vy = ny * sp * 1.25;
  clampSpeed(b);
}

export function mergedRadius(parts: readonly { r: number }[]): number {
  const area = parts.reduce((s, p) => s + p.r * p.r, 0);
  return Math.min(PIT_MAX_R * 1.65, Math.max(PIT_MIN_R, Math.sqrt(Math.max(1, area))));
}
