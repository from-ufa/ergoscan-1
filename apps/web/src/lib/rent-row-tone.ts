/** Due now · soon (≤20 blocks) · later. One tape, three inks. */
export const RENT_SOON_BLOCKS = 20;

export type RentRowTone = "due" | "soon" | "later";

export function rentRowTone(row: {
  rentDue: boolean;
  blocksUntilRent: number;
}): RentRowTone {
  if (row.rentDue || row.blocksUntilRent <= 0) return "due";
  if (row.blocksUntilRent <= RENT_SOON_BLOCKS) return "soon";
  return "later";
}
