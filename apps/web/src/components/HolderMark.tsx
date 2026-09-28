import clsx from "clsx";
import type { HolderBandId } from "@/lib/holder-bands";

type MarkProps = {
  id: HolderBandId;
  size?: number;
  className?: string;
};

const ink = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.65,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Outside-in Archimedean. Pitch is wide so coils stay readable at 44px. */
function spiralPath(turns: number, rOuter: number, rInner: number, steps = 96): string {
  const tMax = turns * Math.PI * 2;
  const phase = -Math.PI / 2;
  const parts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const t = phase + u * tMax;
    const r = rOuter + (rInner - rOuter) * u;
    const x = 12 + r * Math.cos(t);
    const y = 12 + r * Math.sin(t);
    parts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return parts.join(" ");
}

const SPIRAL: Record<HolderBandId, string> = {
  dust: spiralPath(0.58, 8.6, 6.4, 48),
  stacker: spiralPath(1.05, 9.2, 4.8, 72),
  believer: spiralPath(1.5, 9.4, 3.8, 88),
  guardian: spiralPath(1.95, 9.6, 3.1, 104),
  overlord: spiralPath(2.4, 9.8, 2.6, 120),
};

export function HolderMark({ id, size, className }: MarkProps) {
  const d = SPIRAL[id];
  if (!d) return null;
  const sized = size != null ? { width: size, height: size } : {};
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      {...sized}
      className={clsx("holder-mark", `holder-mark--${id}`, className)}
    >
      <g className="hm-spin">
        <path d={d} {...ink} />
      </g>
    </svg>
  );
}
