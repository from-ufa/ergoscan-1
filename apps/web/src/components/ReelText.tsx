"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Digit reel. Same 0–9 strip as the circulating supply figure,
 * played once when the text changes instead of on hover.
 */
export function ReelText({ text }: { text: string }) {
  const reduce = useReducedMotion();
  const prev = useRef(text);
  const [play, setPlay] = useState<{ from: string; id: number } | null>(null);

  useEffect(() => {
    if (prev.current === text) return;
    const from = prev.current;
    prev.current = text;
    if (reduce) {
      setPlay(null);
      return;
    }
    setPlay({ from, id: Date.now() });
  }, [reduce, text]);

  const from = play?.from ?? text;
  const glyphs = zipFigs(from, text);
  const live = play != null && !reduce;

  return (
    <span className="inline-flex items-baseline tabular-nums">
      <span className="sr-only">{text}</span>
      <span aria-hidden className="inline-flex items-baseline">
        {glyphs.map((g, i) =>
          g.digit ? (
            <FigDigit
              key={`${play?.id ?? 0}-${i}`}
              from={g.from}
              to={Number(g.to)}
              delay={(glyphs.length - 1 - i) * 28}
              play={live}
            />
          ) : (
            <span key={`${i}-${g.to}`} className="inline-block whitespace-pre">
              {g.to || "\u00a0"}
            </span>
          )
        )}
      </span>
    </span>
  );
}

function FigDigit({
  from,
  to,
  delay,
  play,
}: {
  from: number;
  to: number;
  delay: number;
  play: boolean;
}) {
  const [y, setY] = useState(play ? from : to);
  useLayoutEffect(() => {
    if (!play || from === to) {
      setY(to);
      return;
    }
    setY(from);
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setY(to));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [from, play, to]);

  return (
    <span className="fig-reel">
      <span
        className="fig-reel-strip"
        style={{
          transform: `translateY(${-y}em)`,
          transitionDelay: `${delay}ms`,
          transitionDuration: play && from !== to ? undefined : "0ms",
        }}
      >
        {Array.from({ length: 10 }, (_, n) => (
          <span key={n} className="block h-[1em] leading-none">
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}

function zipFigs(from: string, to: string): { digit: boolean; from: number; to: string }[] {
  const a = [...from];
  const b = [...to];
  const w = Math.max(a.length, b.length);
  const pad = (xs: string[]) => Array.from({ length: w - xs.length }, () => "").concat(xs);
  const left = pad(a);
  const right = pad(b);
  return right.map((ch, i) => {
    const prev = left[i] ?? "";
    const digit = ch >= "0" && ch <= "9";
    return {
      digit,
      from: prev >= "0" && prev <= "9" ? Number(prev) : 0,
      to: ch,
    };
  });
}
