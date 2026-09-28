/** Phone tab bar only (`<lg`). Desktop rail keeps its own list. */

export type MobileTab = {
  href: string;
  key: string;
  match?: readonly string[];
};

export const MOBILE_TABS: readonly MobileTab[] = [
  { href: "/", key: "nav.home" },
  { href: "/mempool", key: "nav.mempool", match: ["/mempool"] },
  { href: "/transactions", key: "nav.txs", match: ["/transactions", "/tx/"] },
  { href: "/tokens", key: "nav.tokens", match: ["/tokens", "/token/"] },
];

export function pathActive(path: string, item: { href: string; match?: readonly string[] }): boolean {
  if (item.href === "/") return path === "/";
  if (path === item.href) return true;
  return (item.match ?? [item.href]).some(
    (m) => m !== "/" && (path === m || path.startsWith(m.endsWith("/") ? m : `${m}/`))
  );
}

export function moreActive(path: string): boolean {
  return !MOBILE_TABS.some((item) => pathActive(path, item));
}
