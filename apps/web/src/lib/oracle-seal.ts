/** Quiet stroke family — one ink, eight mason brands. Not a rainbow identicon. */
export function oracleSealVariant(id: string): number {
  let h = 2166136261;
  const s = String(id || "0");
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 8;
}

export function oracleSealTilt(id: string): number {
  let h = 2166136261;
  const s = `tilt:${id || "0"}`;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 11) - 5;
}
