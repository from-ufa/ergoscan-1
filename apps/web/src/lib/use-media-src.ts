"use client";

import { useEffect, useMemo, useState } from "react";
import { mediaUrlFallbacks } from "./nft-art";

export function useMediaSrc(
  url: string | null | undefined,
  kind: "image" | "audio" | "video" | "any" = "image"
): { src: string | null; onError: () => void } {
  const urls = useMemo(() => mediaUrlFallbacks(url, kind), [url, kind]);
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
  }, [url, kind]);
  return {
    src: urls[i] ?? null,
    onError: () => setI((n) => n + 1),
  };
}
