"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ScanWait, SCAN_WAIT_SLOW_MS } from "@/components/ScanWait";
import { useT } from "@/lib/i18n/I18nProvider";
import {
  locKey,
  navArrived,
  navTargetOf,
  noteRouteNavigation,
  setRouteNavHandler,
} from "@/lib/route-nav";

type Pending = { from: string; to: string };

const MIN_MS = 220;
const KILL_MS = 15_000;

/**
 * AdaStat wait: previous page stays. Wide full-width top bar on every
 * internal route — home, favorites — not only slow RSC. Overlay
 * after 500ms. One pending target (rapid hops replace `to`, keep `from`).
 */
export function RouteNavProgress() {
  const path = usePathname();
  const t = useT();
  const [pending, setPending] = useState<Pending | null>(null);
  const [bar, setBar] = useState(false);
  const [slow, setSlow] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    setRouteNavHandler((href) => {
      const from = locKey(window.location.pathname, window.location.search);
      const to = navTargetOf(
        href,
        window.location.origin,
        window.location.pathname,
        window.location.search
      );
      if (!to) return;
      setPending((prev) => ({ from: prev?.from ?? from, to }));
    });
    return () => setRouteNavHandler(null);
  }, []);

  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      if (ev.defaultPrevented || ev.button !== 0) return;
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      const a = (ev.target as Element | null)?.closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href) return;
      noteRouteNavigation(href);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!pending) return;
    const check = () => {
      const here = locKey(window.location.pathname, window.location.search);
      if (!navArrived(here, pending.to, pending.from)) return;
      if (!bar) return;
      if (Date.now() - shownAt.current < MIN_MS) return;
      setPending(null);
      setBar(false);
      setSlow(false);
    };
    check();
    const id = window.setInterval(check, 50);
    return () => window.clearInterval(id);
  }, [pending, path, bar]);

  useEffect(() => {
    if (!pending) {
      setBar(false);
      setSlow(false);
      return;
    }
    shownAt.current = Date.now();
    setBar(true);
    const overlay = window.setTimeout(() => setSlow(true), SCAN_WAIT_SLOW_MS);
    const kill = window.setTimeout(() => {
      setPending(null);
      setBar(false);
      setSlow(false);
    }, KILL_MS);
    return () => {
      window.clearTimeout(overlay);
      window.clearTimeout(kill);
    };
  }, [pending]);

  if (!pending || !bar) return null;

  return <ScanWait slow={slow} label={t("common.loading")} />;
}
