export type RankWindowMode = "page" | "loaded";

export function maxOffset(total: number, pageSize: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.floor((total - 1) / pageSize) * pageSize);
}

export function rankWindowNav(p: {
  mode: RankWindowMode;
  offset: number;
  pageSize: number;
  shown: number;
  total: number | null;
  hasMore?: boolean;
  disabled?: boolean;
  /** When false, Next/Prev only — no OFFSET jump even if `total` is set. */
  scrub?: boolean;
}): {
  from: number;
  to: number;
  cap: number;
  canPrev: boolean;
  canNext: boolean;
  canScrub: boolean;
  hide: boolean;
  moreAhead: boolean;
} {
  const { mode, offset, pageSize, shown, total, hasMore, disabled } = p;
  if (mode === "loaded") {
    const from = shown > 0 ? 1 : 0;
    const to = shown;
    const wouldNext =
      hasMore === true || (total != null && shown < total);
    const canPrev = Boolean(!disabled && shown > pageSize);
    const canNext = Boolean(!disabled && wouldNext);
    return {
      from,
      to,
      cap: 0,
      canPrev,
      canNext,
      canScrub: false,
      hide: shown <= pageSize && !wouldNext,
      moreAhead: wouldNext,
    };
  }

  const cap = total != null ? maxOffset(total, pageSize) : offset;
  const from = offset + 1;
  const to =
    total != null ? Math.min(offset + pageSize, total) : offset + shown;
  const packOnly = p.scrub === false;
  const wouldNext = packOnly
    ? hasMore === true ||
      (hasMore !== false && total != null && offset + pageSize < total)
    : total != null
      ? offset < cap
      : hasMore != null
        ? Boolean(hasMore)
        : shown >= pageSize;
  const canPrev = offset > 0 && !disabled;
  const canNext = Boolean(!disabled && wouldNext);
  const hide =
    offset <= 0 &&
    (packOnly
      ? !wouldNext && (total == null || total <= pageSize)
      : total != null
        ? total <= pageSize
        : !(hasMore ?? shown >= pageSize));
  return {
    from,
    to,
    cap,
    canPrev,
    canNext,
    canScrub: !packOnly && total != null && total > pageSize && !disabled,
    hide,
    moreAhead: wouldNext,
  };
}

export function mergeById<T extends { id: string }>(prev: T[], next: T[]): T[] {
  const seen = new Set(prev.map((row) => row.id));
  const extra = next.filter((row) => !seen.has(row.id));
  return extra.length ? [...prev, ...extra] : prev;
}

/** Same keyset as gateway `encodeKeysetCursor(height, id)`. */
export function txKeysetCursor(row: {
  id: string;
  inclusionHeight?: number | null;
} | null | undefined): string | null {
  if (!row?.id) return null;
  return `${row.inclusionHeight ?? -1}:${row.id}`;
}

/** Same keyset as gateway `encodeHolderCursor(amount, address)`. */
export function holderKeysetCursor(row: {
  address: string;
  amount?: number | string;
} | null | undefined): string | null {
  if (!row?.address) return null;
  if (row.amount == null || row.amount === "") return null;
  return `${row.amount}|${row.address}`;
}

export function addrTapeHasMore(
  shown: number,
  total: number,
  hasMore?: boolean | null
): boolean {
  if (hasMore === true) return true;
  return total > shown;
}
