"use client";

import { useCallback, useEffect, useId, useRef, useState, type PointerEvent } from "react";
import clsx from "clsx";
import {
  rankWindowNav,
  type RankWindowMode,
} from "@/lib/rank-window";

const MIN_THUMB = 32;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function snapOffset(raw: number, pageSize: number, cap: number) {
  return clamp(Math.round(raw / pageSize) * pageSize, 0, cap);
}

function Chevron({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <path
        d={dir === "prev" ? "M8.5 3 4.5 7l4 4" : "M5.5 3 9.5 7l-4 4"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const packBtn =
  "chip-press flex h-full w-7 shrink-0 items-center justify-center overflow-hidden rounded-[8px] text-[var(--muted)] transition-colors duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--wash)] hover:text-[var(--text)] disabled:pointer-events-none disabled:opacity-30";

export function RankWindow({
  offset,
  pageSize,
  shown,
  total,
  loc,
  ofLabel,
  prevLabel,
  nextLabel,
  tapeLabel,
  hint,
  disabled,
  hasMore,
  mode = "page",
  scrub,
  onOffset,
}: {
  offset: number;
  pageSize: number;
  shown: number;
  total: number | null;
  loc: string;
  ofLabel: string;
  prevLabel: string;
  nextLabel: string;
  tapeLabel: string;
  hint: string;
  disabled?: boolean;
  /** When `total` is null: Next follows this, not `shown >= pageSize`. */
  hasMore?: boolean;
  /** `loaded`: 1–N of total, Next appends, no OFFSET scrub. */
  mode?: RankWindowMode;
  /** When false, Next/Prev only — slider cannot fake-jump. */
  scrub?: boolean;
  onOffset: (next: number) => void;
}) {
  const labelId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackW, setTrackW] = useState(0);
  const [dragOff, setDragOff] = useState<number | null>(null);
  const dragOffRef = useRef<number | null>(null);
  dragOffRef.current = dragOff;

  const live = dragOff ?? offset;
  const liveRef = useRef(live);
  liveRef.current = live;
  const nav = rankWindowNav({
    mode,
    offset: live,
    pageSize,
    shown,
    total,
    hasMore,
    disabled,
    scrub,
  });
  const { from, to, cap, canPrev, canNext, canScrub, moreAhead } = nav;

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTrackW(el.clientWidth));
    ro.observe(el);
    setTrackW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const offsetAtX = useCallback(
    (clientX: number) => {
      if (total == null || !trackRef.current) return offset;
      const rect = trackRef.current.getBoundingClientRect();
      const w = rect.width;
      const thumbW = Math.max(MIN_THUMB, (pageSize / Math.max(total, 1)) * w);
      const travel = Math.max(1, w - thumbW);
      const x = clientX - rect.left - thumbW / 2;
      const pct = clamp(x / travel, 0, 1);
      return snapOffset(pct * cap, pageSize, cap);
    },
    [cap, offset, pageSize, total]
  );

  const commit = useCallback(
    (next: number) => {
      if (mode === "loaded") {
        if (next <= 0) {
          if (shown > pageSize) onOffset(0);
          return;
        }
        if (canNext) onOffset(Math.max(shown, pageSize));
        return;
      }
      if (scrub === false) {
        if (next > offset) {
          if (canNext) onOffset(offset + pageSize);
          return;
        }
        if (next < offset && canPrev) onOffset(Math.max(0, offset - pageSize));
        return;
      }
      const clamped = total != null ? snapOffset(next, pageSize, cap) : Math.max(0, next);
      if (clamped !== offset) onOffset(clamped);
    },
    [canNext, canPrev, cap, mode, offset, onOffset, pageSize, scrub, shown, total]
  );

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (mode === "loaded" || scrub === false) {
      if (!canNext) return;
      e.preventDefault();
      commit(mode === "loaded" ? pageSize : offset + pageSize);
      return;
    }
    if (!canScrub) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragOff(offsetAtX(e.clientX));
  };

  const isDragging = dragOff != null;

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (ev: globalThis.PointerEvent) => {
      setDragOff(offsetAtX(ev.clientX));
    };
    const onUp = () => {
      const next = dragOffRef.current;
      setDragOff(null);
      if (next != null) commit(next);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [isDragging, commit, offsetAtX]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || disabled) return;
    const onWheel = (ev: WheelEvent) => {
      if (dragOffRef.current != null) return;
      const dir = ev.deltaY > 0 || ev.deltaX > 0 ? pageSize : -pageSize;
      const at = liveRef.current;
      if (dir < 0 && (mode === "loaded" ? shown <= pageSize : at <= 0)) return;
      if (dir > 0 && !moreAhead) return;
      if (dir > 0 && mode !== "loaded" && total != null && at >= cap) return;
      ev.preventDefault();
      commit(at + dir);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [disabled, commit, pageSize, total, cap, shown, moreAhead, mode]);

  const thumbW =
    total != null && trackW > 0
      ? Math.max(
          MIN_THUMB,
          ((mode === "loaded" ? shown : pageSize) / Math.max(total, 1)) * trackW
        )
      : MIN_THUMB;
  const thumbLeft =
    mode === "loaded" || total == null || cap <= 0 || trackW <= thumbW
      ? 0
      : (live / cap) * (trackW - thumbW);

  const ofText =
    total != null && total > 0
      ? ofLabel.replace("{n}", total.toLocaleString(loc))
      : ofLabel.replace("{n}", "—");

  const barRef = useRef<HTMLElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const tick = () => {
      const rect = el.getBoundingClientRect();
      const floor = window.innerHeight - (Number.parseFloat(getComputedStyle(el).bottom) || 8);
      setStuck(Math.abs(floor - rect.bottom) < 2 && rect.top < window.innerHeight - 48);
    };
    tick();
    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    return () => {
      window.removeEventListener("scroll", tick);
      window.removeEventListener("resize", tick);
    };
  }, []);

  if (nav.hide && dragOff == null) {
    return null;
  }

  return (
    <section
      ref={barRef}
      className={clsx("addr-foot", stuck && "is-stuck")}
      title={hint}
    >
      <div className="addr-foot-row">
        <button
          type="button"
          className={packBtn}
          aria-label={prevLabel}
          disabled={!canPrev}
          onClick={() => commit(live - pageSize)}
        >
          <Chevron dir="prev" />
        </button>

        <p id={labelId} className="shrink-0 text-[12px] font-medium tabular-nums text-[var(--text)]">
          {from.toLocaleString(loc)}–{to.toLocaleString(loc)}
        </p>

        <div
          ref={trackRef}
          role="slider"
          tabIndex={
            canScrub || ((mode === "loaded" || scrub === false) && canNext) ? 0 : -1
          }
          aria-labelledby={labelId}
          aria-label={tapeLabel}
          aria-valuemin={1}
          aria-valuemax={total ?? to}
          aria-valuenow={from}
          aria-valuetext={`${from.toLocaleString(loc)}–${to.toLocaleString(loc)}`}
          aria-disabled={!canScrub}
          className={clsx(
            "relative h-full min-w-0 flex-1 select-none",
            canScrub && "cursor-grab touch-none active:cursor-grabbing",
            mode === "loaded" && canNext && "cursor-pointer",
            scrub === false && canNext && "cursor-pointer"
          )}
          onPointerDown={onPointerDown}
          onKeyDown={(e) => {
            if (mode === "loaded" || scrub === false) {
              if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                if (!canPrev) return;
                e.preventDefault();
                commit(offset - pageSize);
                return;
              }
              if (
                e.key === "ArrowRight" ||
                e.key === "ArrowDown" ||
                e.key === "Enter" ||
                e.key === " "
              ) {
                if (!canNext) return;
                e.preventDefault();
                commit(mode === "loaded" ? pageSize : offset + pageSize);
              }
              return;
            }
            if (!canScrub) return;
            if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
              e.preventDefault();
              commit(live - pageSize);
            } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
              e.preventDefault();
              commit(live + pageSize);
            } else if (e.key === "Home") {
              e.preventDefault();
              commit(0);
            } else if (e.key === "End") {
              e.preventDefault();
              commit(cap);
            }
          }}
        >
          <div className="pointer-events-none absolute inset-y-[15px] left-0 right-0 rounded-full bg-[var(--wash-mid)]" />
          <div
            className={clsx(
              "rank-window-thumb pointer-events-none absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-accent",
              isDragging && "is-drag"
            )}
            style={{ width: thumbW, left: thumbLeft }}
          />
        </div>

        {total != null && total > 0 ? (
          <p
            className={clsx(
              "shrink-0 text-[12px] tabular-nums text-[var(--muted)]",
              mode !== "loaded" && scrub !== false && "hidden sm:block"
            )}
          >
            {ofText}
          </p>
        ) : null}

        <button
          type="button"
          className={packBtn}
          aria-label={nextLabel}
          disabled={!canNext}
          onClick={() => commit(live + pageSize)}
        >
          <Chevron dir="next" />
        </button>
      </div>
    </section>
  );
}
