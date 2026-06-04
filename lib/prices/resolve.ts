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
 * Human-readable label for a holding. Priority: curated name (polished), then a
 * name pulled from the price source (`names` map), then ticker, ISIN, dash.
 * Keeps ISINs out of the UI whenever a name is known.
 */
export function displayName(
  isin: string | null,
  ticker: string | null,
  names?: Record<string, string>,
): string {
  if (isin && KNOWN[isin]) return KNOWN[isin].name
  if (isin && names?.[isin]) return names[isin]
  return ticker ?? isin ?? '—'
}

/** Quote currency implied by a Stooq symbol's country suffix (e.g. `aapl.us` → USD). */
const SUFFIX_CURRENCY: Record<string, string> = {
  us: 'USD',
  uk: 'GBP',
  de: 'EUR',
  fr: 'EUR',
  nl: 'EUR',
  es: 'EUR',
  it: 'EUR',
  pt: 'EUR',
  be: 'EUR',
  at: 'EUR',
  ie: 'EUR',
  fi: 'EUR',
  ch: 'CHF',
}

export function currencyForSymbol(symbol: string): string | null {
  const dot = symbol.lastIndexOf('.')
  if (dot < 0) return null
  return SUFFIX_CURRENCY[symbol.slice(dot + 1).toLowerCase()] ?? null
}
