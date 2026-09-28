"use client";

import { useEffect, useRef, useState } from "react";

/**
 * New block slot. No mouth and no flying balls.
 * Height is the share of included txs that have already entered the well.
 */
export function CadenceGrow({
  n,
  total,
  barPx,
  slotH,
  heightLabel,
  ink,
  reduce,
  onDone,
}: {
  n: number;
  total: number;
  barPx: number;
  slotH: number;
  heightLabel: string;
  ink: string;
  reduce: boolean;
  onDone: () => void;
}) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const full = total <= 0 || n >= total;
  const frac = total <= 0 ? 1 : Math.min(1, Math.max(0, n / total));
  const target = full ? Math.max(10, Math.round(barPx)) : n > 0 ? Math.max(2, Math.round(barPx * frac)) : 0;
  const [px, setPx] = useState(reduce ? target : 0);

  useEffect(() => {
    if (reduce) {
      setPx(target);
      return;
    }
    const id = window.requestAnimationFrame(() => setPx(target));
    return () => window.cancelAnimationFrame(id);
  }, [reduce, target]);

  useEffect(() => {
    if (!full) return;
    const t = window.setTimeout(() => doneRef.current(), reduce ? 0 : 480);
    return () => window.clearTimeout(t);
  }, [full, reduce]);

  return (
    <div className="min-w-0 flex-1" aria-hidden>
      <div className="flex flex-col justify-end" style={{ height: slotH }}>
        <div
          className="relative w-full overflow-hidden rounded-[8px]"
          style={{
            height: px,
            backgroundColor: `${ink}66`,
            transition: reduce ? "none" : "height 400ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {n > 0 ? (
            <span
              key={n}
              className="cadence-grow-cap absolute inset-x-0 top-0 h-[3px]"
              style={{ backgroundColor: ink }}
            />
          ) : null}
        </div>
      </div>
      <span className="mt-1.5 block w-full overflow-hidden text-center text-[11px] font-medium tabular-nums leading-none tracking-[-0.04em] whitespace-nowrap text-[var(--muted)]">
        {heightLabel}
      </span>
    </div>
  );
}
