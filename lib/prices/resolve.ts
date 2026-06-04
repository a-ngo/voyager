/**
 * ISIN → Stooq symbol resolution.
 *
 * For a personal portfolio (a handful of instruments) a curated map is far more
 * reliable than auto-resolving OpenFIGI's many listings per ISIN. Each entry
 * records the Stooq symbol and the currency that symbol quotes in (Stooq's CSV
 * does not return currency). Extend KNOWN as you add holdings; OpenFIGI-assisted
 * auto-resolution + DB-backed manual entries are a later upgrade.
 */

export interface ResolvedSymbol {
  stooq: string
  currency: string
  name: string
}

const KNOWN: Record<string, ResolvedSymbol> = {
  IE00B4L5Y983: { stooq: 'iwda.uk', currency: 'GBP', name: 'iShares Core MSCI World' },
  US0378331005: { stooq: 'aapl.us', currency: 'USD', name: 'Apple' },
  US5949181045: { stooq: 'msft.us', currency: 'USD', name: 'Microsoft' },
  DE0008404005: { stooq: 'alv.de', currency: 'EUR', name: 'Allianz' },
}

export function resolveSymbol(isin: string | null): ResolvedSymbol | null {
  if (!isin) return null
  return KNOWN[isin] ?? null
}

/**
 * Human-readable label for a holding. Prefers the curated name, then the
 * ticker, then the ISIN, then a dash. Keeps ISINs out of the UI when we know
 * the instrument.
 */
export function displayName(isin: string | null, ticker: string | null): string {
  if (isin && KNOWN[isin]) return KNOWN[isin].name
  return ticker ?? isin ?? '—'
}
