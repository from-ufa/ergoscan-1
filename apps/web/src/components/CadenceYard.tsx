"use client";

import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { useRouter } from "next/navigation";
import { drawWallE } from "./wall-e";

/**
 * Live-block tape drawn on a canvas, same family as the rent yard.
 * Crates stand on plates. Height is the block's transaction weight.
 * The robot stays at the right and checks the block that is still growing.
 */

export type CadenceYardBlock = {
  id: string;
  height: number;
  weight: number;
  ink: string;
  /** 1 when the block is settled. Lower while transactions are still arriving. */
  frac: number;
};

type Ghost = {
  id: string;
  ink: string;
  weight: number;
  frac: number;
  x: number;
  hopUntil: number;
  leaving: boolean;
};

type Hit = { id: string; x: number; top: number; bot: number };

const SLOTS = 7;
/** A 39-tx block fills the track. That is the busy size the row is drawn against. */
const BUSY_TX = 39;
/** At or under this, nobody on screen is a full block. Don't stretch them to the ceiling. */
const QUIET_TX = 4;
const BODY_MIN = 14;
const BODY_SPAN = 40;

/**
 * Quiet rows stay the height they would have beside a busy block.
 * Each extra tx still adds a step, so 1 and 4 are not the same slab.
 * A busier block on screen becomes the ceiling again.
 */
function crateBody(weight: number, peak: number): number {
  const w = Math.max(1, weight);
  const beside = BODY_MIN + (w / BUSY_TX) * BODY_SPAN;
  if (peak > QUIET_TX) return BODY_MIN + (w / peak) * BODY_SPAN;
  return beside + (w - 1) * 2.4;
}

export function CadenceYard({
  blocks,
  reduce,
  colorsReady,
  label,
  onHover,
}: {
  blocks: CadenceYardBlock[];
  reduce: boolean;
  colorsReady: boolean;
  label: string;
  onHover: (id: string | null) => void;
}) {
  const host = useRef<HTMLCanvasElement>(null);
  const blocksRef = useRef(blocks);
  const onHoverRef = useRef(onHover);
  const colorsReadyRef = useRef(colorsReady);
  blocksRef.current = blocks;
  onHoverRef.current = onHover;
  colorsReadyRef.current = colorsReady;
  const hits = useRef<Hit[]>([]);
  const router = useRouter();

  useEffect(() => {
    const canvas = host.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    const ghosts = new Map<string, Ghost>();
    let primed = false;
    let head = 0;
    let look = 0;
    let pickSwing = 0;
    let roll = 0;
    let swingUntil = 0;
    let waveTick = -1;
    let waveId: string | null = null;
    let phase: "wait" | "intro" | "live" = "wait";
    let introStart = 0;

    const paint = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const parent = canvas.parentElement;
      const w = Math.max(1, parent?.clientWidth ?? 320);
      const h = Math.max(1, parent?.clientHeight ?? 84);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const list = blocksRef.current;
      const ground = h - 10;
      const robotX = w - 34;
      const slotW = Math.max(28, (robotX - 36) / SLOTS);
      if (phase === "wait" && colorsReadyRef.current && list.length) {
        phase = reduce ? "live" : "intro";
        introStart = now;
      }
      if (phase === "wait") {
        hits.current = [];
        raf = requestAnimationFrame(paint);
        return;
      }
      const introT = phase === "intro" ? now - introStart : 0;
      const driveU = 1 - Math.exp(-introT / 120);
      if (phase === "intro" && driveU > 0.98 && introT > 900) phase = "live";
      const live = new Set(list.map((b) => b.id));
      const k = reduce ? 1 : 1 - Math.exp(-dt / 0.16);

      for (const g of ghosts.values()) {
        if (!live.has(g.id)) g.leaving = true;
      }
      list.forEach((b, i) => {
        const slot = SLOTS - 1 - (list.length - 1 - i);
        const target = 16 + (slot + 0.5) * slotW;
        const prev = ghosts.get(b.id);
        const grew = prev ? b.frac > prev.frac + 1e-4 : false;
        const placing = phase !== "live";
        const x = placing || !primed || reduce ? target : (prev?.x ?? w + 28);
        ghosts.set(b.id, {
          id: b.id,
          ink: b.ink,
          weight: b.weight,
          frac: b.frac,
          x: !placing && prev && !reduce ? prev.x + (target - prev.x) * k : x,
          hopUntil: grew ? now + 420 : (prev?.hopUntil ?? 0),
          leaving: false,
        });
        if (grew) swingUntil = now + 420;
      });
      for (const g of [...ghosts.values()]) {
        if (!g.leaving) continue;
        if (reduce) {
          ghosts.delete(g.id);
          continue;
        }
        g.x += (-52 - g.x) * k;
        if (g.x < -40) ghosts.delete(g.id);
      }
      primed = true;

      const settled: string[] = [];
      if (!reduce && phase === "live") {
        list.forEach((b, i) => {
          if (b.frac < 1) return;
          const g = ghosts.get(b.id);
          if (!g || g.leaving) return;
          const slot = SLOTS - 1 - (list.length - 1 - i);
          const target = 16 + (slot + 0.5) * slotW;
          if (Math.abs(g.x - target) > 8) return;
          settled.push(b.id);
        });
        const tick = Math.floor(now / 1500);
        if (tick !== waveTick) {
          waveTick = tick;
          waveId = settled.length ? settled[tick % settled.length]! : null;
        }
        const waving = waveId ? ghosts.get(waveId) : undefined;
        if (!waving || waving.leaving) waveId = null;
      }
      const waveT = waveTick < 0 ? 1500 : now - waveTick * 1500;

      const drawn: Hit[] = [];
      const order = [...ghosts.values()].sort((a, b) => a.x - b.x);
      const peak = Math.max(1, ...order.map((g) => g.weight));
      for (const g of order) {
        const full = crateBody(g.weight, peak);
        const body = g.frac >= 1 ? full : Math.max(5, full * g.frac);
        const grewHop = !reduce && now < g.hopUntil ? Math.sin(((g.hopUntil - now) / 420) * Math.PI) : 0;
        const waveHop =
          g.id === waveId && waveT >= 0 && waveT < 420 ? Math.sin((waveT / 420) * Math.PI) : 0;
        const hop = phase === "live" ? Math.max(grewHop, waveHop) : 0;
        let fallPx = 0;
        if (phase === "intro") {
          const span = robotX + 40;
          const ratio = Math.min(0.97, Math.max(0, (g.x + 40) / span));
          const pass = -120 * Math.log(1 - ratio);
          const ft = introT - pass;
          if (ft < 0) continue;
          const u = Math.min(1, ft / 320);
          const ease = 1 - (1 - u) ** 3;
          fallPx = (1 - ease) * (body + 30);
        }
        drawBlock(ctx, g.x, ground, body, g.ink, hop, fallPx, g.frac < 1);
        drawn.push({
          id: g.id,
          x: g.x,
          top: ground - body - 16 - hop * 10 - fallPx,
          bot: ground + 6,
        });
      }
      hits.current = drawn;

      const newest = list[list.length - 1];
      if (newest && !reduce) {
        roll += dt * 10;
        if (now < swingUntil) {
          pickSwing = Math.sin(((swingUntil - now) / 420) * Math.PI);
          head = 0;
          look = 0;
        } else {
          pickSwing = 0;
          const phase = now / 980;
          const sweep = Math.sin(phase);
          head = Math.sign(sweep) * Math.pow(Math.abs(sweep), 0.72) * 0.58;
          look = Math.sin(phase + 0.85) * 2.35;
        }
      } else {
        head = 0;
        look = 0;
        pickSwing = 0;
      }
      const driveX = -40 + (robotX + 40) * Math.min(1, driveU);
      const rx = phase === "intro" ? driveX : robotX;
      if (phase === "intro") roll += dt * 42;
      if (newest) {
        drawWallE(ctx, { x: rx, y: ground, head, look, pick: pickSwing, roll });
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
    let bestD = 36;
    for (const hit of hits.current) {
      if (y < hit.top || y > hit.bot) continue;
      const d = Math.abs(hit.x - x);
      if (d < bestD) {
        best = hit;
        bestD = d;
      }
    }
    return best?.id ?? null;
  };

  return (
    <canvas
      ref={host}
      className="h-full w-full"
      role="img"
      aria-label={label}
      onPointerMove={(ev) => {
        const id = pick(ev);
        ev.currentTarget.style.cursor = id ? "pointer" : "default";
        onHoverRef.current(id);
      }}
      onPointerLeave={(ev) => {
        ev.currentTarget.style.cursor = "default";
        onHoverRef.current(null);
      }}
      onClick={(ev: ReactMouseEvent<HTMLCanvasElement>) => {
        const id = pick(ev);
        if (id) router.push(`/block/${encodeURIComponent(id)}`);
      }}
    />
  );
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  body: number,
  ink: string,
  hop: number,
  fallPx: number,
  growing: boolean
) {
  const lift = hop * 10 + fallPx;
  const air = Math.min(1, lift / 22);
  const hw = 33;
  const depth = 6;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = `rgba(0,0,0,${0.26 * (1 - air * 0.72)})`;
  ctx.beginPath();
  ctx.ellipse(0, 4, 28 * (1 + air * 0.42), 2.4 * (1 - air * 0.2), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(x, y - lift);
  const top = -4 - body;
  const bot = -3;
  ctx.lineJoin = "round";
  ctx.lineWidth = 1.15;
  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(-hw, bot - depth * 0.25);
  ctx.lineTo(0, bot);
  ctx.lineTo(0, top + depth);
  ctx.lineTo(-hw, top + depth * 0.35);
  ctx.closePath();
  ctx.globalAlpha = 0.94;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, bot);
  ctx.lineTo(hw, bot - depth * 0.3);
  ctx.lineTo(hw, top + depth * 0.45);
  ctx.lineTo(0, top + depth);
  ctx.closePath();
  ctx.globalAlpha = 0.52;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-hw, top + depth * 0.35);
  ctx.lineTo(0, top);
  ctx.lineTo(hw, top + depth * 0.45);
  ctx.lineTo(0, top + depth);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (growing) {
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const slats = Math.max(1, Math.min(4, Math.round(body / 12)));
  for (let i = 0; i < slats; i++) {
    const yy = bot - 5 - i * 7;
    if (yy <= top + depth + 3) break;
    ctx.moveTo(-hw + 2, yy);
    ctx.lineTo(-1, yy + 1);
  }
  ctx.stroke();
  ctx.restore();
}

