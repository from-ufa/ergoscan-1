/** DEX venue filter for /defi/spectrum vs /defi/lithos. */
export type DefiVenue = "spectrum" | "lithos_dex";

export function defiVenuePath(venue: DefiVenue): string {
  return venue === "lithos_dex" ? "/defi/lithos" : "/defi/spectrum";
}

export function defiVenueQuery(venue: DefiVenue | undefined): string | null {
  if (venue === "lithos_dex") return "lithos_dex";
  if (venue === "spectrum") return "spectrum";
  return null;
}
