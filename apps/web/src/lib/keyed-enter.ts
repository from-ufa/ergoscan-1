"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const ENTER_MS = 400;

export function enteringIds<T extends { id: string }>(prev: T[], next: T[]): string[] {
  const had = new Set(prev.map((r) => r.id));
  return next.filter((r) => !had.has(r.id)).map((r) => r.id);
}

export function leavingIds<T extends { id: string }>(prev: T[], next: T[]): string[] {
  const have = new Set(next.map((r) => r.id));
  return prev.filter((r) => !have.has(r.id)).map((r) => r.id);
}

export function useEnterIds(ms = ENTER_MS, initialIds: readonly string[] = []) {
  const [ids, setIds] = useState<Set<string>>(() => new Set(initialIds));
  const live = useRef<Set<string>>(new Set(initialIds));
  const timer = useRef<number | null>(null);

  const arm = useCallback(() => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      live.current = new Set();
      setIds(new Set());
    }, ms);
  }, [ms]);

  const mark = useCallback(
    (next: string[]) => {
      if (!next.length) return;
      const merged = new Set(live.current);
      for (const id of next) merged.add(id);
      live.current = merged;
      setIds(new Set(merged));
      arm();
    },
    [arm]
  );

  useEffect(() => {
    if (live.current.size) arm();
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    };
  }, [arm]);

  const enterClass = useCallback(
    (id: string) => (live.current.has(id) || ids.has(id) ? "list-row-enter" : undefined),
    [ids]
  );

  return { mark, enterClass };
}

export const SNAPSHOT_FETCH: RequestInit = { cache: "no-cache" };

/** Bust shared-cache list GETs when chain.tip moves. Gateway ignores `h`. */
export function snapshotPath(path: string, height?: number | null): string {
  if (height == null || !Number.isFinite(height)) return path;
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}h=${Math.trunc(height)}`;
}
