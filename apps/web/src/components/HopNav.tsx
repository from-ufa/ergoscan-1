"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";

const hopCell =
  "block-hop chip-press flex min-w-0 flex-1 items-center justify-center overflow-hidden rounded-[10px] py-1.5 text-[var(--muted)] transition-colors duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)]";

function HopMark({ dir, burst }: { dir: "back" | "fwd"; burst: number }) {
  const cap = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" className="block-hop-mark" aria-hidden>
      <g key={burst} className="block-hop-run">
        {dir === "back" ? (
          <>
            <rect className="block-hop-tile" x="3.4" y="6.8" width="9.4" height="10.4" rx="2.1" {...cap} />
            <path className="block-hop-arrow" d="M21 7.4 14.8 12 21 16.6" {...cap} />
          </>
        ) : (
          <>
            <path className="block-hop-arrow" d="M3 7.4 9.2 12 3 16.6" {...cap} />
            <rect className="block-hop-tile" x="11.2" y="6.8" width="9.4" height="10.4" rx="2.1" {...cap} />
          </>
        )}
      </g>
    </svg>
  );
}

/** Neighbor hop: same mark as the block card. `storageKey` keeps block vs tx bursts apart. */
export function HopNav({
  dir,
  pageId,
  href,
  label,
  hint,
  storageKey,
  onPrefetch,
}: {
  dir: "back" | "fwd";
  pageId: string;
  href: string | null;
  label: string;
  hint?: string;
  storageKey: string;
  onPrefetch?: (href: string) => void;
}) {
  const [burst, setBurst] = useState(0);
  const go = () => {
    try {
      sessionStorage.setItem(storageKey, dir);
    } catch {
      /* private mode */
    }
    setBurst((n) => n + 1);
  };

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      if (sessionStorage.getItem(storageKey) !== dir) return;
      setBurst((n) => n + 1);
    } catch {
      /* private mode */
    }
    const id = window.setTimeout(() => {
      try {
        if (sessionStorage.getItem(storageKey) === dir) {
          sessionStorage.removeItem(storageKey);
        }
      } catch {
        /* private mode */
      }
    }, 600);
    return () => window.clearTimeout(id);
  }, [dir, pageId, storageKey]);

  useEffect(() => {
    if (burst === 0) return;
    const id = window.setTimeout(() => setBurst(0), 520);
    return () => window.clearTimeout(id);
  }, [burst]);

  const mark = <HopMark dir={dir} burst={burst} />;
  const going = burst > 0;
  if (!href) {
    return (
      <span
        data-dir={dir}
        className={clsx(hopCell, going && "is-go is-pressed", "cursor-default opacity-40")}
        aria-disabled
        aria-label={label}
      >
        {mark}
      </span>
    );
  }
  return (
    <Link
      href={href}
      data-dir={dir}
      title={hint}
      aria-label={hint ?? label}
      onPointerDown={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        go();
      }}
      onClick={(e) => {
        if (e.detail === 0) go();
      }}
      onPointerEnter={() => onPrefetch?.(href)}
      onFocus={() => onPrefetch?.(href)}
      className={clsx(
        hopCell,
        going && "is-go is-pressed",
        "hover:text-[var(--text)]"
      )}
    >
      {mark}
    </Link>
  );
}
