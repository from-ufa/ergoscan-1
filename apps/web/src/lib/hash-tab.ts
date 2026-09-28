/** In-page tabs: update hash without native jump/scroll. */

export function readHashTab<T extends string>(tabs: readonly T[], fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const h = window.location.hash.replace(/^#/, "") as T;
  return tabs.includes(h) ? h : fallback;
}

export function setHashTab(tab: string, ev?: { preventDefault(): void }) {
  ev?.preventDefault();
  if (typeof window === "undefined") return;
  const next = `${window.location.pathname}${window.location.search}#${tab}`;
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` === next) {
    return;
  }
  window.history.replaceState(null, "", next);
}
