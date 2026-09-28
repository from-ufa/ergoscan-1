"use client";

import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { useRouter } from "next/navigation";
import { rentToneInk } from "@/lib/rent-miner-patrol";
import type { RentTapeRow } from "@ergoscan/shared";

/**
 * Crates sit still. On open, the robot visits boxes one or two blocks
 * from collection first: the lid lifts, his eyes rise and the pupils spin,
 * then the lid shuts. After that pass he checks the rest.
 */
const SOON_BLOCKS = 2;
type Hit = { address: string; x: number; y: number };
type Slot = { x: number; y: number; depth: number };

type Stop = { x: number; y: number };

function routeAround(from: Stop, fromSlot: Slot | null, toSlot: Slot, w: number, h: number, slots: Slot[]): Stop[] {
  const ys = [...new Set(slots.map((s) => s.y))].sort((a, b) => a - b);
  const back = ys[0] ?? h * 0.4;
  const front = ys[ys.length - 1] ?? h * 0.72;
  const laneY = (slotY: number) =>
    Math.abs(slotY - back) <= Math.abs(slotY - front)
      ? Math.max(22, back - 36)
      : Math.min(h - 18, front + 32);
  const beside = (s: Slot): Stop => ({ x: s.x - 28, y: s.y + 2 });
  const to = beside(toSlot);
  const fromLane = fromSlot ? laneY(fromSlot.y) : laneY(toSlot.y);
  const toLane = laneY(toSlot.y);
  const pts: Stop[] = [{ x: from.x, y: fromLane }];
  if (Math.abs(fromLane - toLane) > 8) {
    const margin = from.x > w * 0.5 ? w - 16 : 16;
    pts.push({ x: margin, y: fromLane });
    pts.push({ x: margin, y: toLane });
  }
  pts.push({ x: to.x, y: toLane });
  pts.push(to);
  return pts;
}

function soonFirst(list: RentTapeRow[]): number[] {
  const soon: number[] = [];
  const rest: number[] = [];
  list.forEach((row, i) => {
    if (row.blocksUntilRent <= SOON_BLOCKS) soon.push(i);
    else rest.push(i);
  });
  return [...soon, ...rest];
}

function lidOpen(u: number): number {
  if (u < 0.12) return 0;
  if (u < 0.4) return (u - 0.12) / 0.28;
  if (u < 0.7) return 1;
  return Math.max(0, 1 - (u - 0.7) / 0.3);
}

function eyePop(u: number): number {
  if (u < 0.28 || u > 0.78) return 0;
  return Math.sin(((u - 0.28) / 0.5) * Math.PI);
}

function slotsOf(n: number, w: number, h: number): Slot[] {
  if (n <= 0) return [];
  const rows = n > 7 ? 2 : 1;
  const front = Math.ceil(n / rows);
  const back = n - front;
  const counts = rows === 1 ? [n] : [back, front];
  const ys = rows === 1 ? [h * 0.62] : [h * 0.4, h * 0.74];
  const out: Slot[] = [];
  for (let r = 0; r < counts.length; r++) {
    const count = counts[r] ?? 0;
    const y = ys[r] ?? h * 0.6;
    const depth = rows === 1 ? 1 : r === 0 ? 0.86 : 1;
    for (let k = 0; k < count; k++) {
      const x = 28 + ((k + 0.5) / count) * (w - 56);
      out.push({ x, y, depth });
    }
  }
  return out;
}

export function RentBelt({
  rows,
  reduce,
  hover,
  onHover,
  onLead,
}: {
  rows: RentTapeRow[];
  reduce: boolean;
  hover: string | null;
  onHover: (address: string | null) => void;
  onLead: (address: string | null) => void;
}) {
  const host = useRef<HTMLCanvasElement>(null);
  const rowsRef = useRef(rows);
  const hoverRef = useRef(hover);
  const onHoverRef = useRef(onHover);
  const onLeadRef = useRef(onLead);
  rowsRef.current = rows;
  hoverRef.current = hover;
  onHoverRef.current = onHover;
  onLeadRef.current = onLead;
  const router = useRouter();
  const hits = useRef<Hit[]>([]);

  useEffect(() => {
    const canvas = host.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    let rx = 40;
    let ry = 80;
    let seq: number[] = [];
    let si = 0;
    let firstPass = true;
    let mode: "go" | "check" = "go";
    let path: Stop[] = [];
    let leg = 0;
    let routed = -1;
    let struck = "";
    let gesture: "no" | "open" = "no";
    let swingFrom = 0;
    let lastLead: string | null = null;
    let roll = 0;

    const paint = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const parent = canvas.parentElement;
      const w = Math.max(1, parent?.clientWidth ?? 320);
      const h = Math.max(1, parent?.clientHeight ?? 180);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const list = rowsRef.current;
      const slots = slotsOf(list.length, w, h);
      const nanos = list.map((r) => r.rentNano);
      if (list.length && seq.length !== list.length) {
        seq = soonFirst(list);
        si = 0;
        firstPass = true;
        routed = -1;
        mode = "go";
      }
      const idx = seq[si] ?? 0;
      const cur = list[idx];
      const slot = slots[idx];
      let head = 0;
      let pickSwing = 0;
      let hopT = 0;
      let eyeLift = 0;
      let eyeScale = 1;
      let pupil = 0;
      if (cur && slot && !reduce) {
        if (mode === "go") {
          if (routed !== idx) {
            const prevI = seq[(si - 1 + seq.length) % seq.length] ?? 0;
            const prev = si === 0 && routed < 0 ? null : (slots[prevI] ?? null);
            path = routeAround({ x: rx, y: ry }, prev, slot, w, h, slots);
            leg = 0;
            routed = idx;
          }
          const goal = path[leg];
          if (!goal) {
            mode = "check";
            struck = cur.address;
            gesture = cur.blocksUntilRent <= SOON_BLOCKS ? "open" : "no";
            swingFrom = now;
          } else {
            const dx = goal.x - rx;
            const dy = goal.y - ry;
            const dist = Math.hypot(dx, dy);
            const step = Math.min(dist, 54 * dt);
            if (dist > 2.5) {
              rx += (dx / dist) * step;
              ry += (dy / dist) * step;
              roll += step;
            } else if (leg < path.length - 1) {
              leg += 1;
            } else {
              mode = "check";
              struck = cur.address;
              gesture = cur.blocksUntilRent <= SOON_BLOCKS ? "open" : "no";
              swingFrom = now;
            }
          }
        } else {
          const dur = gesture === "open" ? 1500 : 640;
          hopT = Math.min(1, (now - swingFrom) / dur);
          if (gesture === "no") head = Math.sin(hopT * Math.PI * 3) * 0.45;
          else {
            if (hopT < 0.2) pickSwing = Math.sin((hopT / 0.2) * Math.PI);
            const pop = eyePop(hopT);
            eyeLift = pop * 8;
            eyeScale = 1 + pop * 0.62;
            pupil = pop > 0 ? now * 0.012 : 0;
          }
          if (hopT >= 1) {
            mode = "go";
            si += 1;
            if (firstPass && si >= seq.length) {
              seq = list.map((_, i) => i);
              si = 0;
              firstPass = false;
            } else if (!firstPass) {
              si = si % Math.max(1, seq.length);
            }
            routed = -1;
            hopT = 0;
          }
        }
      } else if (cur && slot && reduce) {
        rx = slot.x - 30;
        ry = slot.y + 4;
      }

      const drawn: Hit[] = [];
      const order = list
        .map((row, i) => ({ row, slot: slots[i]! }))
        .sort((a, b) => a.slot.y - b.slot.y);
      for (const item of order) {
        const checking = mode === "check" && item.row.address === struck;
        const hop = checking && gesture === "no" ? Math.sin(hopT * Math.PI) : 0;
        const lid = checking && gesture === "open" ? lidOpen(hopT) : 0;
        drawDock(ctx, item.slot.x, item.slot.y, item.slot.depth);
        drawCrate(
          ctx,
          item.slot.x,
          item.slot.y,
          rentToneInk(item.row.rentNano, nanos),
          item.row.boxCount,
          item.slot.depth,
          hop,
          lid
        );
        drawn.push({ address: item.row.address, x: item.slot.x, y: item.slot.y - 10 - hop * 12 });
      }
      hits.current = drawn;

      if (cur) {
        const next = hoverRef.current ?? cur.address;
        if (next !== lastLead) {
          lastLead = next;
          onLeadRef.current(next);
        }
        drawWall(ctx, rx, ry, head, pickSwing, roll, eyeLift, eyeScale, pupil);
      }
      raf = requestAnimationFrame(paint);
    };

    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  const pick = (ev: { clientX: number; clientY: number }) => {
    const canvas = host.current;
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const y = ev.clientY - r.top;
    let best: Hit | null = null;
    let dd = 20 * 20;
    for (const h of hits.current) {
      const d = (h.x - x) ** 2 + (h.y - y) ** 2;
      if (d < dd) {
        dd = d;
        best = h;
      }
    }
    return best;
  };

  return (
    <canvas
      ref={host}
      className="h-full w-full"
      onPointerMove={(ev) => onHover(pick(ev)?.address ?? null)}
      onPointerLeave={() => onHover(null)}
      onClick={(ev: ReactMouseEvent<HTMLCanvasElement>) => {
        const hit = pick(ev);
        if (hit) router.push(`/address/${encodeURIComponent(hit.address)}`);
      }}
    />
  );
}

function drawDock(ctx: CanvasRenderingContext2D, x: number, y: number, depth: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(depth, depth * 0.62);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 6, 18, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.roundRect(-15, -2, 30, 8, 3);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(-15, -2, 30, 1.5);
  ctx.restore();
}

function drawCrate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ink: string,
  boxes: number,
  depth: number,
  hop: number,
  lid: number
) {
  const layers = boxes >= 4 ? 3 : boxes >= 2 ? 2 : 1;
  const lift = hop * 14;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(depth, depth);
  ctx.fillStyle = `rgba(0,0,0,${0.32 * (1 - hop * 0.55)})`;
  ctx.beginPath();
  ctx.ellipse(0, 4, 11 * (1 - hop * 0.28), 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(0, -14 - lift);
  ctx.scale(1 + hop * 0.04, 1 - hop * 0.06);
  ctx.lineJoin = "round";
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(2, 8);
  ctx.lineTo(14, 0);
  ctx.lineTo(14, 12);
  ctx.lineTo(2, 20);
  ctx.closePath();
  ctx.globalAlpha = 0.5;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-12, 2);
  ctx.lineTo(2, 8);
  ctx.lineTo(2, 20);
  ctx.lineTo(-12, 14);
  ctx.closePath();
  ctx.globalAlpha = 0.3;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.stroke();
  ctx.globalAlpha = 0.65;
  for (let i = 0; i < layers; i++) {
    const yy = 9 + i * 2.2;
    ctx.beginPath();
    ctx.moveTo(-9, yy);
    ctx.lineTo(0.5, yy + 1.3);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(-6, -2);
  ctx.rotate(-lid * 1.15);
  ctx.translate(6, 2);
  ctx.beginPath();
  ctx.moveTo(-12, 2);
  ctx.lineTo(0, -6);
  ctx.lineTo(14, 0);
  ctx.lineTo(2, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function drawWall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  head: number,
  pickSwing: number,
  roll = 0,
  eyeLift = 0,
  eyeScale = 1,
  pupil = 0
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = "round";
  ctx.lineWidth = 1.35;
  ctx.strokeStyle = "#3a2a14";
  ctx.fillStyle = "#2a2622";
  ctx.beginPath();
  ctx.roundRect(-20, 8, 16, 8, 3);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(4, 8, 16, 8, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f0c14a";
  const tread = ((roll * 0.35) % 5 + 5) % 5;
  for (const ox of [-18, 6]) {
    ctx.fillRect(ox + tread, 10, 2.2, 4);
  }
  ctx.fillStyle = "#e2a23a";
  ctx.beginPath();
  ctx.roundRect(-15, -8, 30, 18, 5);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.moveTo(-8, -2);
  ctx.lineTo(8, -2);
  ctx.stroke();
  ctx.save();
  ctx.translate(0, -10 - eyeLift);
  ctx.rotate(head);
  ctx.scale(eyeScale, eyeScale);
  ctx.fillStyle = "#f7f3ea";
  ctx.strokeStyle = "#3a2a14";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(-6, -8, 6.5, 0, Math.PI * 2);
  ctx.arc(7, -8, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#3a2a14";
  ctx.fillRect(-2, -9, 5, 2.2);
  ctx.fillStyle = "#1c1917";
  const look = eyeLift > 0.4 ? 0 : head * 3;
  const ox = Math.cos(pupil) * 1.7;
  const oy = Math.sin(pupil) * 1.15;
  ctx.beginPath();
  ctx.arc(-5 + look + ox, -8 + oy, 2.3, 0, Math.PI * 2);
  ctx.arc(8 + look + ox, -8 + oy, 2.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(12, -2);
  ctx.rotate(-0.85 + pickSwing * 1.15);
  ctx.strokeStyle = "#d6d3d1";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(15, -12);
  ctx.stroke();
  ctx.fillStyle = "#f0c14a";
  ctx.strokeStyle = "#3a2a14";
  ctx.lineWidth = 1.15;
  ctx.beginPath();
  ctx.moveTo(11, -16);
  ctx.lineTo(22, -12);
  ctx.lineTo(15, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}
