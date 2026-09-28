import clsx from "clsx";
import { oracleSealTilt, oracleSealVariant } from "@/lib/oracle-seal";

const ink = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.65,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/**
 * Mason brands — who posted into the well. Same stroke, eight different cuts.
 * Not a rotated ring. Hash picks the brand; tilt stays tiny.
 */
const CUTS: string[][] = [
  ["M7.5 18.2V6.7", "M16.5 18.2V6.7", "M7.5 6.7h9"],
  ["M12 18.4V11.8", "M12 11.8 7 6.4", "M12 11.8 17 6.4"],
  ["M8 6.5v11", "M8 6.5c6.8 0 8.8 2.5 8.8 5.5S14.8 17.5 8 17.5"],
  ["M12 5.4 17.7 12 12 18.6 6.3 12Z"],
  ["M9.6 18.3 15.4 5.7", "M6.6 18.3 12.4 5.7"],
  ["M6.7 17.5H12V12h5.3"],
  ["M12 11.4v7", "M12 6.1a3.55 3.55 0 1 1 0 7.1 3.55 3.55 0 0 1 0-7.1"],
  ["M12 5.5v13", "M6.7 8.7l10.6 6.6", "M17.3 8.7l-10.6 6.6"],
];

function Hub() {
  return (
    <>
      <path d="M12 4.2 18.8 8.1v7.8L12 19.8 5.2 15.9V8.1Z" {...ink} />
      <path d="M8.1 12.2h7.8" {...ink} />
    </>
  );
}

function Operator({ n }: { n: number }) {
  return (
    <>
      {(CUTS[n] ?? CUTS[0]).map((d) => (
        <path key={d} d={d} {...ink} />
      ))}
    </>
  );
}

export function OracleSeal({
  id,
  className,
  hub = false,
}: {
  id: string;
  className?: string;
  hub?: boolean;
}) {
  const n = oracleSealVariant(id);
  const tilt = hub ? 0 : oracleSealTilt(id);
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("oracle-seal", className)}
    >
      <g transform={`rotate(${tilt} 12 12)`}>{hub ? <Hub /> : <Operator n={n} />}</g>
    </svg>
  );
}
