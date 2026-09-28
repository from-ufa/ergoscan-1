export const SKIN_FLOATS = ["ada", "off"] as const;
export type SkinFloat = (typeof SKIN_FLOATS)[number];

/** AdaStat paper: opaque module + drop shadow. `off` is the flat hairline. */
export function parseSkinFloat(v: string | null | undefined): SkinFloat {
  return v === "off" ? "off" : "ada";
}
