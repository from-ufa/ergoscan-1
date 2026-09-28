"use client";

/**
 * DOM canvas host for the AMM engine.
 * React Native later: call `paintAmmChart` on a Skia/canvas surface instead.
 */
import { useEffect, useRef } from "react";
import {
  EDGE,
  AXIS,
  hitIndex,
  maxOffset,
  modelKey,
  paintAmmChart,
  scrubFromHit,
  visibleBars,
} from "../index";
import type { ChartModel } from "../types";

const LERP = 0.085;
const DRAG_SOFT = 2.5;
const INERTIA = 0.94;
const FADE_MS = 420;

export function AmmChart({
  model,
  className,
  height = 280,
  onScrubPrice,
}: {
  model: ChartModel;
  className?: string;
  height?: number;
  onScrubPrice?: (price: number | null) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef(model);
  const prevRef = useRef<ChartModel | null>(null);
  const keyRef = useRef(modelKey(model));
  const fadeRef = useRef(1);
  const fadeFromRef = useRef(0);
  const drawOffRef = useRef(0);
  const targetOffRef = useRef(0);
  const velRef = useRef(0);
  const hoverRef = useRef<number | null>(null);
  const scrubRef = useRef(onScrubPrice);
  scrubRef.current = onScrubPrice;
  const dragRef = useRef({ x: 0, t: 0, down: false });

  useEffect(() => {
    const next = modelKey(model);
    if (next !== keyRef.current) {
      prevRef.current = modelRef.current.slots.length
        ? modelRef.current
        : prevRef.current;
      keyRef.current = next;
      fadeRef.current = 0;
      fadeFromRef.current = performance.now();
      targetOffRef.current = 0;
      velRef.current = 0;
    }
    modelRef.current = model;
  }, [model]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = true;

    const paint = () => {
      const data = modelRef.current;
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth || 320;
      const h = height;
      if (
        canvas.width !== Math.floor(w * dpr) ||
        canvas.height !== Math.floor(h * dpr)
      ) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!data.slots.length) return;
      const vis = visibleBars(w);
      const fade = 1 - (1 - fadeRef.current) ** 3;
      const prev = prevRef.current;
      if (prev && fade < 1) {
        paintAmmChart({
          ctx,
          w,
          h,
          model: prev,
          offset: 0,
          visible: vis,
          alpha: 1 - fade,
        });
      }
      paintAmmChart({
        ctx,
        w,
        h,
        model: data,
        offset: drawOffRef.current,
        visible: vis,
        hover: hoverRef.current,
        alpha: fade,
      });
    };

    const tick = (now: number) => {
      if (!running) return;
      const w = wrap.clientWidth || 320;
      const vis = visibleBars(w);
      const maxOff = maxOffset(modelRef.current.slots.length, vis);
      if (!dragRef.current.down) {
        targetOffRef.current += velRef.current;
        velRef.current *= INERTIA;
        if (Math.abs(velRef.current) < 0.002) velRef.current = 0;
      }
      if (targetOffRef.current < 0) {
        targetOffRef.current = 0;
        velRef.current = 0;
      }
      if (targetOffRef.current > maxOff) {
        targetOffRef.current = maxOff;
        velRef.current = 0;
      }
      drawOffRef.current += (targetOffRef.current - drawOffRef.current) * LERP;
      if (Math.abs(targetOffRef.current - drawOffRef.current) < 0.001) {
        drawOffRef.current = targetOffRef.current;
      }
      if (fadeRef.current < 1) {
        fadeRef.current = Math.min(1, (now - fadeFromRef.current) / FADE_MS);
        if (fadeRef.current >= 1) prevRef.current = null;
      }
      paint();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => paint());
    ro.observe(wrap);

    const onDown = (e: PointerEvent) => {
      dragRef.current = { x: e.clientX, t: performance.now(), down: true };
      velRef.current = 0;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const vis = visibleBars(rect.width);
      const slot = (rect.width - EDGE - AXIS) / vis;
      if (dragRef.current.down) {
        const now = performance.now();
        const dx = e.clientX - dragRef.current.x;
        const dt = Math.max(8, now - dragRef.current.t);
        const dBars = dx / Math.max(slot, 6) / DRAG_SOFT;
        targetOffRef.current += dBars;
        velRef.current = dBars * (16 / dt);
        dragRef.current.x = e.clientX;
        dragRef.current.t = now;
      }
      const i = hitIndex(e.clientX, rect.left, rect.width, vis);
      hoverRef.current = i;
      const s = scrubFromHit(modelRef.current, drawOffRef.current, vis, i);
      scrubRef.current?.(s?.price ?? null);
    };
    const onUp = (e: PointerEvent) => {
      dragRef.current.down = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
    };
    const onLeave = () => {
      hoverRef.current = null;
      scrubRef.current?.(null);
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onLeave);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      scrubRef.current?.(null);
    };
  }, [height]);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height,
        touchAction: "none",
        userSelect: "none",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
    </div>
  );
}
