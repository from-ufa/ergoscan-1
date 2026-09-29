/** Cinematic swap for the oracle council tile. Innards only — not the card. */

export const SCENE_EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];
export const SCENE_BURST_EASE: [number, number, number, number] = [0.15, 1.38, 0.32, 1];
export const SCENE_FORM_EASE: [number, number, number, number] = [0.14, 1.22, 0.28, 1];

export const SCENE_MS = {
  flash: 420,
  pinch: 360,
  gather: 540,
  beat: 130,
  burst: 460,
  form: 600,
  bind: 520,
} as const;

/** Council lattice: 3 rows × current columns (4 on sm = 3×4). */
export const COUNCIL_ROWS = 3;

export type ScenePt = { x: number; y: number };

export function sceneCouncilCap(cols: number, rows = COUNCIL_ROWS): number {
  return Math.max(1, Math.floor(cols)) * Math.max(1, Math.floor(rows));
}

/** Seat the pinch on: 2nd row / 2nd operator when n>5, else 2nd of the first row. */
export function scenePinchIndex(n: number, cols: number): number {
  const count = Math.max(0, Math.floor(n));
  if (count <= 1) return 0;
  const width = Math.max(1, Math.floor(cols));
  if (count > 5) return Math.min(count - 1, width + 1);
  return Math.min(count - 1, 1);
}

export function scenePinchAt(pts: ScenePt[], n: number, cols: number): ScenePt {
  if (!pts.length) return { x: 0, y: 0 };
  return pts[scenePinchIndex(n, cols)] ?? pts[0]!;
}

export function sceneCentroid(pts: ScenePt[]): ScenePt {
  if (!pts.length) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

/** Golden-angle disc around the pinch point. One body sits on the point. */
export function sceneCluster(n: number, c: ScenePt, radius: number): ScenePt[] {
  const count = Math.max(0, Math.floor(n));
  if (!count) return [];
  if (count === 1) return [{ x: c.x, y: c.y }];
  const r = Math.max(8, radius);
  const ga = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, i) => {
    const a = i * ga;
    const d = r * Math.sqrt((i + 0.5) / count);
    return { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d };
  });
}

export function sceneGatherDelay(i: number, pts: ScenePt[], c: ScenePt, maxMs: number): number {
  if (pts.length <= 1) return 0;
  let max = 1;
  const dist: number[] = pts.map((p) => {
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d > max) max = d;
    return d;
  });
  return ((dist[i] ?? 0) / max) * maxMs;
}

/** Fallback lattice when the incoming grid has not painted yet. */
export function sceneGridSlots(
  n: number,
  cols: number,
  box: { w: number; h: number },
  mark = 36
): ScenePt[] {
  const count = Math.max(0, Math.floor(n));
  const width = Math.max(1, Math.floor(cols));
  if (!count || box.w <= 0) return [];
  const rows = Math.max(1, Math.ceil(count / width));
  const cellW = box.w / width;
  const cellH = Math.max(mark + 28, box.h > 0 ? box.h / rows : mark + 28);
  return Array.from({ length: count }, (_, i) => {
    const col = i % width;
    const row = Math.floor(i / width);
    return {
      x: cellW * col + cellW / 2,
      y: cellH * row + mark / 2 + 4,
    };
  });
}

/** Mark centers in the wrap's layout box.
 *  Painted rects include the opening flight: translateZ(160px) under a
 *  640px perspective is 4/3. Pass `layout` (clientWidth/clientHeight) so
 *  the threads stay in the size the card lands at.
 */
export function sceneFromRects(
  wrap: { left: number; top: number; width: number; height: number },
  marks: { left: number; top: number; width: number; height: number }[],
  layout?: { w: number; h: number }
): { box: { w: number; h: number }; pts: ScenePt[] } {
  const w = layout && layout.w > 0 ? layout.w : wrap.width;
  const h = layout && layout.h > 0 ? layout.h : wrap.height;
  const sx = w > 0 && wrap.width > 0 ? wrap.width / w : 1;
  const sy = h > 0 && wrap.height > 0 ? wrap.height / h : 1;
  return {
    box: { w, h },
    pts: marks.map((r) => ({
      x: (r.left + r.width / 2 - wrap.left) / sx,
      y: (r.top + r.height / 2 - wrap.top) / sy,
    })),
  };
}

export function splitOracleLens<T extends { live?: boolean | null }>(
  ops: T[]
): { live: T[]; silent: T[] } {
  const live: T[] = [];
  const silent: T[] = [];
  for (const op of ops) {
    if (op.live === true) live.push(op);
    else silent.push(op);
  }
  return { live, silent };
}

export function sortSilentOldest<T extends { tsMs?: number | null; height?: number | null }>(
  ops: T[]
): T[] {
  return [...ops].sort((a, b) => {
    if (a.tsMs != null && b.tsMs != null) return a.tsMs - b.tsMs;
    if (a.tsMs != null) return -1;
    if (b.tsMs != null) return 1;
    return (a.height ?? 0) - (b.height ?? 0);
  });
}
