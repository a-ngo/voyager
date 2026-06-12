import type { AssetClass } from '@/lib/import/types'

/**
 * Portfolio X-Ray aggregation. Pure: positions + per-instrument profiles in,
 * breakdowns out. ETFs are looked through to their underlying sectors/holdings;
 * direct stocks contribute their own sector/country. No DB, no fetch.
 */

export interface InstrumentProfile {
  /** True when Yahoo returns fund look-through. */
  isFund: boolean
  /** Yahoo sector key → weight (0..1). Funds only. */
  sectorWeights: Record<string, number>
  /** Top holdings (funds only): underlying symbol, name, weight (0..1). */
  holdings: { symbol: string; name: string; weight: number }[]
  country: string | null
  sector: string | null
}

export interface XrayPosition {
  key: string
  name: string
  /** Resolved Yahoo symbol; null if unresolved. */
  symbol: string | null
  assetClass: AssetClass | null
  eurValue: number
}

export interface AllocSlice {
  label: string
  value: number
  /** Percent of the portfolio total. */
  weight: number
}

export interface Breakdown {
  slices: AllocSlice[]
  /** Share of the portfolio total that could be classified (0..1). */
  coverage: number
}

export interface LookThroughHolding {
  symbol: string | null
  name: string
  value: number
  weight: number
  directValue: number
  fundValue: number
  /** Held directly, via a fund, or both. */
  via: 'direct' | 'fund' | 'both'
  /** Underlying company sector; null until enriched. */
  sector: string | null
}

const SECTOR_LABELS: Record<string, string> = {
  technology: 'Technology',
  financial_services: 'Financial Services',
  consumer_cyclical: 'Consumer Cyclical',
  communication_services: 'Communication Services',
  healthcare: 'Healthcare',
  industrials: 'Industrials',
  consumer_defensive: 'Consumer Defensive',
  energy: 'Energy',
  basic_materials: 'Basic Materials',
  realestate: 'Real Estate',
  utilities: 'Utilities',
}

const COUNTRY_CCY: Record<string, string> = {
  'United States': 'USD',
  Canada: 'CAD',
  'United Kingdom': 'GBP',
  Germany: 'EUR',
  France: 'EUR',
  Netherlands: 'EUR',
  Ireland: 'EUR',
  Spain: 'EUR',
  Italy: 'EUR',
  Switzerland: 'CHF',
  Japan: 'JPY',
  China: 'CNY',
  Taiwan: 'TWD',
  'South Korea': 'KRW',
  'Hong Kong': 'HKD',
  Australia: 'AUD',
  India: 'INR',
  Denmark: 'DKK',
  Sweden: 'SEK',
}

function toSlices(byLabel: Map<string, number>, total: number): AllocSlice[] {
  return [...byLabel.entries()]
    .map(([label, value]) => ({ label, value, weight: total > 0 ? (value / total) * 100 : 0 }))
    .sort((a, b) => b.value - a.value)
}

/** Look-through holdings: direct positions at full value, fund top-holdings scaled by weight. */
export function lookThroughHoldings(
  positions: XrayPosition[],
  profiles: Map<string, InstrumentProfile>,
): LookThroughHolding[] {
  const total = positions.reduce((s, p) => s + p.eurValue, 0)
  const buckets = new Map<string, { symbol: string | null; name: string; direct: number; fund: number }>()
  const add = (key: string, symbol: string | null, name: string, value: number, source: 'direct' | 'fund') => {
    const b = buckets.get(key) ?? { symbol, name, direct: 0, fund: 0 }
    b[source] += value
    if (!b.symbol && symbol) b.symbol = symbol
    buckets.set(key, b)
  }

  for (const pos of positions) {
    const profile = pos.symbol ? profiles.get(pos.symbol) : undefined
    if (profile?.isFund && profile.holdings.length > 0) {
      for (const h of profile.holdings) {
        add(h.symbol.toUpperCase(), h.symbol.toUpperCase(), h.name, h.weight * pos.eurValue, 'fund')
      }
    } else {
      add((pos.symbol ?? pos.name).toUpperCase(), pos.symbol, pos.name, pos.eurValue, 'direct')
    }
  }

  return [...buckets.values()]
    .map((b) => {
      const value = b.direct + b.fund
      return {
        symbol: b.symbol,
        name: b.name,
        value,
        weight: total > 0 ? (value / total) * 100 : 0,
        directValue: b.direct,
        fundValue: b.fund,
        via: b.direct > 0 && b.fund > 0 ? 'both' : b.direct > 0 ? 'direct' : 'fund',
        sector: null,
      } as LookThroughHolding
    })
    .sort((a, b) => b.value - a.value)
}

/** Sector allocation: funds via sector weights, stocks via their own sector. */
export function sectorAllocation(
  positions: XrayPosition[],
  profiles: Map<string, InstrumentProfile>,
): Breakdown {
  const total = positions.reduce((s, p) => s + p.eurValue, 0)
  const byLabel = new Map<string, number>()
  let classified = 0
  const bump = (label: string, value: number) => byLabel.set(label, (byLabel.get(label) ?? 0) + value)

  for (const pos of positions) {
    const profile = pos.symbol ? profiles.get(pos.symbol) : undefined
    if (profile?.isFund && Object.keys(profile.sectorWeights).length > 0) {
      for (const [key, w] of Object.entries(profile.sectorWeights)) {
        const v = w * pos.eurValue
        bump(SECTOR_LABELS[key] ?? key, v)
        classified += v
      }
    } else if (profile?.sector) {
      bump(profile.sector, pos.eurValue)
      classified += pos.eurValue
    }
  }

  return { slices: toSlices(byLabel, total), coverage: total > 0 ? classified / total : 0 }
}

/** Country allocation over the look-through holdings, using a symbol→country map. */
export function countryAllocation(
  holdings: LookThroughHolding[],
  countryBySymbol: Map<string, string>,
  total: number,
): Breakdown {
  const byLabel = new Map<string, number>()
  let classified = 0
  for (const h of holdings) {
    const country = h.symbol ? countryBySymbol.get(h.symbol.toUpperCase()) : undefined
    if (!country) continue
    byLabel.set(country, (byLabel.get(country) ?? 0) + h.value)
    classified += h.value
  }
  return { slices: toSlices(byLabel, total), coverage: total > 0 ? classified / total : 0 }
}

/** Currency exposure derived from a country breakdown. */
export function currencyExposure(countries: Breakdown, total: number): Breakdown {
  const byLabel = new Map<string, number>()
  let classified = 0
  for (const s of countries.slices) {
    const ccy = COUNTRY_CCY[s.label]
    if (!ccy) continue
    byLabel.set(ccy, (byLabel.get(ccy) ?? 0) + s.value)
    classified += s.value
  }
  return { slices: toSlices(byLabel, total), coverage: total > 0 ? classified / total : 0 }
}

export interface Concentration {
  holdings: number
  /** Combined weight of the 10 largest positions (percent). */
  top10Weight: number
  largestWeight: number
  /** Effective number of holdings = 1 / Σ wᵢ² (diversification). */
  effectiveHoldings: number
}

/** Concentration metrics over the direct positions (not look-through). */
export function concentration(positions: XrayPosition[]): Concentration {
  const total = positions.reduce((s, p) => s + p.eurValue, 0)
  const weights = positions.map((p) => (total > 0 ? p.eurValue / total : 0)).sort((a, b) => b - a)
  const top10 = weights.slice(0, 10).reduce((s, w) => s + w, 0)
  const hhi = weights.reduce((s, w) => s + w * w, 0)
  return {
    holdings: positions.length,
    top10Weight: top10 * 100,
    largestWeight: (weights[0] ?? 0) * 100,
    effectiveHoldings: hhi > 0 ? 1 / hhi : 0,
  }
}
