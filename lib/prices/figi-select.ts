/**
 * Pure OpenFIGI → Yahoo candidate selection (no network, no server-only — unit
 * testable). The network call lives in openfigi.ts and delegates here.
 *
 * OpenFIGI returns many Bloomberg-coded listings per ISIN; we map the exchanges
 * we care about to Yahoo suffixes + currencies, ordered by the ISIN's home
 * market. The caller tries candidates against Yahoo and keeps the first that
 * actually prices.
 */

export interface SymbolCandidate {
  yahoo: string
  currency: string
  name: string | null
}

export interface FigiItem {
  ticker?: string
  exchCode?: string
  name?: string
}

interface ExchangeGroup {
  codes: string[] // Bloomberg exchCodes, most-preferred first
  suffix: string
  currency: string
}

const GROUPS: Record<string, ExchangeGroup> = {
  de: { codes: ['GY', 'GR', 'GF', 'GS', 'GB', 'GM', 'GH', 'GW', 'GD'], suffix: 'DE', currency: 'EUR' },
  us: { codes: ['UW', 'UN', 'UQ', 'UA', 'UR', 'UP', 'UV', 'UF', 'UM', 'US'], suffix: '', currency: 'USD' },
  uk: { codes: ['LN'], suffix: 'L', currency: 'GBP' },
  fr: { codes: ['FP'], suffix: 'PA', currency: 'EUR' },
  nl: { codes: ['NA'], suffix: 'AS', currency: 'EUR' },
}

/** Order exchange groups by the ISIN's home country to minimize failed lookups. */
function groupOrder(isin: string): string[] {
  const country = isin.slice(0, 2).toUpperCase()
  if (country === 'US' || country === 'CA') return ['us', 'de', 'uk']
  if (country === 'GB') return ['uk', 'us', 'de']
  if (country === 'DE') return ['de', 'us', 'uk']
  return ['de', 'fr', 'nl', 'uk', 'us'] // EU-domiciled funds/ETFs: prefer EUR listings
}

function toYahooSymbol(ticker: string, suffix: string): string {
  const clean = ticker.toUpperCase().replace(/\//g, '-').replace(/\s+/g, '')
  return suffix ? `${clean}.${suffix}` : clean // US listings carry no suffix
}

/** Turn OpenFIGI listings into ordered, de-duplicated Yahoo candidates. */
export function selectCandidates(isin: string, data: FigiItem[]): SymbolCandidate[] {
  const out: SymbolCandidate[] = []
  const seen = new Set<string>()

  for (const groupKey of groupOrder(isin)) {
    const group = GROUPS[groupKey]
    if (!group) continue
    for (const code of group.codes) {
      const item = data.find((d) => d.exchCode === code && d.ticker)
      if (!item?.ticker) continue
      const yahoo = toYahooSymbol(item.ticker, group.suffix)
      if (seen.has(yahoo)) continue
      seen.add(yahoo)
      out.push({ yahoo, currency: group.currency, name: item.name ?? null })
    }
  }
  return out
}
