/** Spectrum page snapshot filters. Tape is CFMM+N2N; volume / trades KPI stay N2T. */

export const SPECTRUM_VENUE_SQL = `venue IN ('spectrum_cfmm', 'spectrum_n2n')`;
export const SPECTRUM_N2T_SQL = `(base_id IS NULL OR base_id = repeat('0', 64))`;

export function spectrumEventTokenSql(param: number): string {
  return `(token_id = $${param} OR base_id = $${param})`;
}

export function spectrumPoolTokenSql(alias: string, param: number): string {
  const a = alias ? `${alias}.` : "";
  return `(${a}quote_token = $${param} OR ${a}base_token = $${param})`;
}
