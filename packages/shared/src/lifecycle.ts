/**
 * Box lifecycle labels for the eUTXO graph (spent vs created vs data-read).
 */

export type BoxLifecycle = "spent" | "created" | "data";

export function boxKindFromIo(side: "in" | "out" | "data"): BoxLifecycle {
  if (side === "out") return "created";
  if (side === "data") return "data";
  return "spent";
}
