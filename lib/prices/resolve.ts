/**
 * ISIN → Yahoo Finance symbol resolution.
 *
 * For a personal portfolio (a handful of instruments) a curated map is far more
 * reliable than auto-resolving OpenFIGI's many listings per ISIN. Each entry
 * records the Yahoo symbol and the currency it quotes in (used as a fallback —
 * Yahoo also returns the currency in its payload). Extend KNOWN as you add
 * holdings; OpenFIGI-assisted auto-resolution + DB-backed manual entries are a
 * later upgrade.
 */

export interface ResolvedSymbol {
  yahoo: string
  currency: string
  name: string
}

const KNOWN: Record<string, ResolvedSymbol> = {
  IE00B4L5Y983: { yahoo: 'IWDA.AS', currency: 'EUR', name: 'iShares Core MSCI World' },
  US0378331005: { yahoo: 'AAPL', currency: 'USD', name: 'Apple' },
  US5949181045: { yahoo: 'MSFT', currency: 'USD', name: 'Microsoft' },
  DE0008404005: { yahoo: 'ALV.DE', currency: 'EUR', name: 'Allianz' },
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

/** Quote currency implied by a Yahoo symbol's exchange suffix (e.g. `ALV.DE` → EUR). */
const SUFFIX_CURRENCY: Record<string, string> = {
  de: 'EUR', // XETRA
  f: 'EUR', // Frankfurt
  as: 'EUR', // Euronext Amsterdam
  pa: 'EUR', // Euronext Paris
  br: 'EUR', // Euronext Brussels
  mi: 'EUR', // Borsa Italiana
  mc: 'EUR', // Madrid
  vi: 'EUR', // Vienna
  l: 'GBP', // London
  sw: 'CHF', // SIX Swiss
}

/** Yahoo US listings carry no suffix; a suffixed symbol maps via SUFFIX_CURRENCY. */
export function currencyForSymbol(symbol: string): string | null {
  const dot = symbol.lastIndexOf('.')
  if (dot < 0) return 'USD'
  return SUFFIX_CURRENCY[symbol.slice(dot + 1).toLowerCase()] ?? null
}
