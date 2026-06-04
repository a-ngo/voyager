/**
 * Pure OpenFIGI → Stooq candidate selection (no network, no server-only — unit
 * testable). The network call lives in openfigi.ts and delegates here.
 *
 * OpenFIGI returns many Bloomberg-coded listings per ISIN; we map the exchanges
 * we care about to Stooq suffixes + currencies, ordered by the ISIN's home
 * market. The caller tries candidates against Stooq and keeps the first that
 * actually prices.
 */

export interface SymbolCandidate {
  stooq: string
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
  de: { codes: ['GY', 'GR', 'GF', 'GS', 'GB', 'GM', 'GH', 'GW', 'GD'], suffix: 'de', currency: 'EUR' },
  us: { codes: ['UW', 'UN', 'UQ', 'UA', 'UR', 'UP', 'UV', 'UF', 'UM', 'US'], suffix: 'us', currency: 'USD' },
  uk: { codes: ['LN'], suffix: 'uk', currency: 'GBP' },
  fr: { codes: ['FP'], suffix: 'fr', currency: 'EUR' },
  nl: { codes: ['NA'], suffix: 'nl', currency: 'EUR' },
}

/** Order exchange groups by the ISIN's home country to minimize failed lookups. */
function groupOrder(isin: string): string[] {
  const country = isin.slice(0, 2).toUpperCase()
  if (country === 'US' || country === 'CA') return ['us', 'de', 'uk']
  if (country === 'GB') return ['uk', 'us', 'de']
  if (country === 'DE') return ['de', 'us', 'uk']
  return ['de', 'fr', 'nl', 'uk', 'us'] // EU-domiciled funds/ETFs: prefer EUR listings
}

function toStooqSymbol(ticker: string, suffix: string): string {
  const clean = ticker.toLowerCase().replace(/\//g, '-').replace(/\s+/g, '')
  return `${clean}.${suffix}`
}

/** Turn OpenFIGI listings into ordered, de-duplicated Stooq candidates. */
export function selectCandidates(isin: string, data: FigiItem[]): SymbolCandidate[] {
  const out: SymbolCandidate[] = []
  const seen = new Set<string>()

  for (const groupKey of groupOrder(isin)) {
    const group = GROUPS[groupKey]
    if (!group) continue
    for (const code of group.codes) {
      const item = data.find((d) => d.exchCode === code && d.ticker)
      if (!item?.ticker) continue
      const stooq = toStooqSymbol(item.ticker, group.suffix)
      if (seen.has(stooq)) continue
      seen.add(stooq)
      out.push({ stooq, currency: group.currency, name: item.name ?? null })
    }
  }
  return out
}
