"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { usePaperPress } from "@/lib/use-paper-press";

const TYPE_MS = 70;
const TYPE_CYCLE_MS = 5000;

/** Dumb loop: type the placeholder, hold, restart on a 5s clock. */
function useTypeLoop(text: string, on: boolean) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    if (!on) {
      setShown("");
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(text);
      return;
    }
    const t0 = Date.now();
    const tick = () => {
      const elapsed = (Date.now() - t0) % TYPE_CYCLE_MS;
      setShown(text.slice(0, Math.min(text.length, Math.floor(elapsed / TYPE_MS))));
    };
    tick();
    const id = window.setInterval(tick, 50);
    return () => window.clearInterval(id);
  }, [on, text]);
  return shown;
}

export function CatalogSearchTile({
  q,
  onQ,
  searchLabel,
  placeholder,
  enter,
}: {
  q: string;
  onQ: (v: string) => void;
  searchLabel: string;
  placeholder: string;
  enter?: number;
}) {
  const { armed, bind } = usePaperPress(true);
  const [focus, setFocus] = useState(false);
  const play = !q && !focus;
  const typed = useTypeLoop(placeholder, play);
  const down = Boolean(q) || focus;
  return (
    <label
      className={clsx(
        "token-search kpi-tile kpi-tile--press kpi-tile--dense flex h-full min-w-0 cursor-text items-center gap-2 rounded-[20px] border border-[var(--border)] bg-[var(--module)] px-3 py-1.5",
        enter != null && "home-tile-enter",
        armed && "is-armed",
        down && "is-pressed"
      )}
      style={enter != null ? { ["--enter" as string]: enter } : undefined}
      {...bind}
    >
      <span className="min-w-0 flex-1 overflow-hidden">
        <span className="block text-[13px] leading-[1.15] text-[var(--muted)]">{searchLabel}</span>
        <span className="relative mt-0.5 block h-[1.15em] text-[17px]">
          <input
            value={q}
            onChange={(e) => onQ(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            aria-label={placeholder}
            className="absolute inset-0 block h-full min-w-0 w-full appearance-none border-0 bg-transparent p-0 text-[17px] font-semibold leading-[1.15] tracking-tight text-[var(--text)] shadow-none outline-none"
          />
          {play ? (
            <span
              className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-nowrap text-[17px] font-medium leading-[1.15] tracking-tight text-[var(--muted-2)]"
              aria-hidden
            >
              {typed}
              <span className="type-caret" />
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-[12px] leading-[1.15] text-[var(--muted-2)]" aria-hidden>
          {"\u00a0"}
        </span>
      </span>
    </label>
  );
}
