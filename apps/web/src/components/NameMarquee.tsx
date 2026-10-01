"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import clsx from "clsx";

/** Overflowing names scroll; short names stay still. Never CSS-truncate. */
export function NameMarquee({
  text,
  className,
  style,
  fade = false,
  pxPerSec = 36,
}: {
  text: string;
  className?: string;
  style?: CSSProperties;
  fade?: boolean;
  /** Lower = slower. Default matches address names. */
  pxPerSec?: number;
}) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [sec, setSec] = useState(9);

  useEffect(() => {
    const wrap = wrapRef.current;
    const measure = measureRef.current;
    if (!wrap || !measure) return;
    const check = () => {
      const need = measure.scrollWidth > wrap.clientWidth + 1;
      setOverflow(need);
      if (need) {
        const px = Math.max(measure.scrollWidth, 1);
        const floor = pxPerSec <= 20 ? 14 : 8;
        const ceil = pxPerSec <= 20 ? 64 : 48;
        setSec(Math.min(ceil, Math.max(floor, px / pxPerSec)));
      }
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [text, pxPerSec]);

  return (
    <span
      ref={wrapRef}
      title={text}
      className={clsx(
        "name-marquee",
        overflow && "is-overflow",
        fade && overflow && "is-fade",
        className
      )}
      style={{ ...style, ["--marquee-s" as string]: `${sec}s` }}
    >
      <span ref={measureRef} className="name-marquee-measure">
        {text}
      </span>
      <span className="name-marquee-track">
        <span className="name-marquee-inner">{text}</span>
        {overflow ? (
          <span className="name-marquee-inner" aria-hidden>
            {text}
          </span>
        ) : null}
      </span>
    </span>
  );
}
