"use client";

import { useEffect, useState } from "react";
import { INK_EVENT, parseSkinInk, type SkinInk } from "./skin-ink";

/** Subscribe to `data-ink` so charts/chrome re-read CSS tokens. */
export function useInk(): SkinInk {
  const [ink, setInk] = useState<SkinInk>("oled");

  useEffect(() => {
    const sync = () => setInk(parseSkinInk(document.documentElement.dataset.ink));
    sync();
    window.addEventListener(INK_EVENT, sync);
    return () => window.removeEventListener(INK_EVENT, sync);
  }, []);

  return ink;
}
