/** Pending client navigations. AdaStat rule: keep the current page until the next one is ready. */

type Handler = (href: string) => void;

let handler: Handler | null = null;

export function setRouteNavHandler(next: Handler | null): void {
  handler = next;
}

/** Clicks on `<a>` are observed in Shell. Call this for `router.push`. */
export function noteRouteNavigation(href: string): void {
  handler?.(href);
}

export function locKey(path: string, search = ""): string {
  const p = normalizePath(path);
  const s = normalizeSearch(search);
  return s ? `${p}?${s}` : p;
}

export function navTargetOf(
  href: string,
  origin: string,
  fromPath: string,
  fromSearch = ""
): string | null {
  const parsed = parseInternalHref(href, origin);
  if (!parsed) return null;
  const from = locKey(fromPath, fromSearch);
  const to = locKey(parsed.path, parsed.search);
  if (to === from) return null;
  return to;
}

export function navArrived(here: string, pendingTo: string, pendingFrom: string): boolean {
  if (here === pendingTo) return true;
  if (isSearchLoc(pendingTo) && here !== pendingFrom && !isSearchLoc(here)) return true;
  return false;
}

export function parseInternalHref(
  href: string,
  origin: string
): { path: string; search: string; hash: string } | null {
  const trimmed = href.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith("#") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("tel:")
  ) {
    return null;
  }
  try {
    const url = new URL(trimmed, origin || "http://127.0.0.1");
    if (origin) {
      const here = new URL(origin);
      if (url.origin !== here.origin) return null;
    } else if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return {
      path: normalizePath(url.pathname),
      search: normalizeSearch(url.search),
      hash: url.hash,
    };
  } catch {
    return null;
  }
}

function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function normalizeSearch(search: string): string {
  return search.startsWith("?") ? search.slice(1) : search;
}

function isSearchLoc(loc: string): boolean {
  return loc === "/search" || loc.startsWith("/search?");
}

export function isHomeLoc(loc: string): boolean {
  return loc === "/" || loc.startsWith("/?");
}
