import type { ReactNode } from "react";
import clsx from "clsx";

type EntityId = "exchange" | "pool" | "contract" | "protocol";

type MarkProps = {
  id: EntityId;
  className?: string;
};

const ink = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.65,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Piggy bank — one mark for every exchange. */
function Exchange() {
  return (
    <>
      <path
        d="M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z"
        {...ink}
      />
      <path d="M16 10h.01" {...ink} />
      <path d="M2 8v1a2 2 0 0 0 2 2h1" {...ink} />
    </>
  );
}

/** Three nodes — mining pool. */
function Pool() {
  return (
    <>
      <circle cx="12" cy="8.1" r="2.55" {...ink} />
      <circle cx="8.05" cy="15.35" r="2.55" {...ink} />
      <circle cx="15.95" cy="15.35" r="2.55" {...ink} />
    </>
  );
}

/** Script box. */
function Contract() {
  return (
    <>
      <rect x="6.4" y="5.6" width="11.2" height="12.8" rx="2.2" {...ink} />
      <path d="M8.8 10.2h6.4M8.8 13.6h4.4" {...ink} />
    </>
  );
}

/** System core — emission, fee, reemission. */
function Protocol() {
  return (
    <>
      <circle cx="12" cy="12" r="7.35" {...ink} />
      <path d="M12 8.4v7.2M8.4 12h7.2" {...ink} />
    </>
  );
}

const BODY: Record<EntityId, () => ReactNode> = {
  exchange: Exchange,
  pool: Pool,
  contract: Contract,
  protocol: Protocol,
};

export function EntityMark({ id, className }: MarkProps) {
  const Body = BODY[id];
  if (!Body) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("entity-mark", `entity-mark--${id}`, className)}
    >
      <g className="em-spin">
        <Body />
      </g>
    </svg>
  );
}
