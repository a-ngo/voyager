import 'server-only'
import { resolveToSymbol } from '@/lib/prices/quotes'
import { fetchInstrumentProfile } from '@/lib/prices/yahoo-fundamentals'
import {
  concentration,
  countryAllocation,
  currencyExposure,
  lookThroughHoldings,
  regionAllocation,
  sectorAllocation,
  type Breakdown,
  type Concentration,
  type InstrumentProfile,
  type LookThroughHolding,
  type XrayPosition,
} from '@/lib/finance/xray'
import { portfolioCost, type CostResult } from '@/lib/finance/cost'
import { getValuedOverview } from './valued-overview'
import type { OverviewSlice } from './overview'

export interface XrayData {
  hasData: boolean
  total: number
  currency: string
  assetMix: OverviewSlice[]
  sectors: Breakdown
  countries: Breakdown
  regions: Breakdown
  currencies: Breakdown
  topHoldings: LookThroughHolding[]
  overlaps: LookThroughHolding[]
  concentration: Concentration
  cost: CostResult
}

const EMPTY_COST: CostResult = { weightedTerPct: 0, annualCost: 0, coverage: 0, funds: [] }

const EMPTY: Breakdown = { slices: [], coverage: 0 }
const UNDERLYING_COUNTRY_LIMIT = 30

/**
 * Portfolio X-Ray: look through ETFs into sectors, countries, currencies, and
 * underlying holdings. Resolves each position to a Yahoo symbol and fetches its
 * `quoteSummary` profile (cached). Country is built from the look-through
 * holdings' home countries, so it carries a coverage figure.
 */
export async function getXray(userId: string): Promise<XrayData> {
  const o = await getValuedOverview(userId)
  const priced = o.positions.filter((p) => p.priced && p.marketValue != null && p.marketValue > 0)

  if (priced.length === 0) {
    return {
      hasData: false,
      total: 0,
      currency: o.currency,
      assetMix: o.allocation,
      sectors: EMPTY,
      countries: EMPTY,
      regions: EMPTY,
      currencies: EMPTY,
      topHoldings: [],
      overlaps: [],
      concentration: { holdings: 0, top10Weight: 0, largestWeight: 0, effectiveHoldings: 0 },
      cost: EMPTY_COST,
    }
  }

  // Resolve each position to a Yahoo symbol and fetch its look-through profile.
  const positions: XrayPosition[] = []
  const profiles = new Map<string, InstrumentProfile>()
  for (const p of priced) {
    const resolved = p.isin ? await resolveToSymbol(p.isin) : null
    const symbol = resolved?.symbol ?? p.ticker ?? null
    positions.push({
      key: p.key,
      name: p.label,
      symbol,
      assetClass: p.assetClass,
      eurValue: p.marketValue!,
    })
    if (symbol && !profiles.has(symbol)) {
      const profile = await fetchInstrumentProfile(symbol)
      if (profile) profiles.set(symbol, profile)
    }
  }

  const total = positions.reduce((s, p) => s + p.eurValue, 0)
  const holdings = lookThroughHoldings(positions, profiles)
  const sectors = sectorAllocation(positions, profiles)

  // Country + sector for the underlying holdings. Position profiles already carry
  // stock country/sector; fetch the rest for the largest look-through holdings
  // (bounded). One fetch fills both maps.
  const countryBySymbol = new Map<string, string>()
  const sectorBySymbol = new Map<string, string>()
  for (const [sym, profile] of profiles) {
    if (profile.country) countryBySymbol.set(sym.toUpperCase(), profile.country)
    if (profile.sector) sectorBySymbol.set(sym.toUpperCase(), profile.sector)
  }
  for (const h of holdings.slice(0, UNDERLYING_COUNTRY_LIMIT)) {
    if (!h.symbol) continue
    const key = h.symbol.toUpperCase()
    if (countryBySymbol.has(key) && sectorBySymbol.has(key)) continue
    const profile = await fetchInstrumentProfile(h.symbol)
    if (profile?.country) countryBySymbol.set(key, profile.country)
    if (profile?.sector) sectorBySymbol.set(key, profile.sector)
  }

  const countries = countryAllocation(holdings, countryBySymbol, total)
  const regions = regionAllocation(countries, total)
  const currencies = currencyExposure(countries, total)

  // Fund cost: each position's TER (funds only; stocks/cash are fee-free; a fund
  // whose TER Yahoo doesn't report stays null and lowers coverage).
  const cost = portfolioCost(
    positions.map((p) => {
      const profile = p.symbol ? profiles.get(p.symbol) : undefined
      return { name: p.name, value: p.eurValue, ter: profile?.isFund ? profile.ter : 0 }
    }),
  )

  return {
    hasData: true,
    total,
    currency: o.currency,
    assetMix: o.allocation,
    sectors,
    countries,
    regions,
    currencies,
    topHoldings: holdings.slice(0, 20).map((h) => ({
      ...h,
      sector: h.symbol ? (sectorBySymbol.get(h.symbol.toUpperCase()) ?? null) : null,
    })),
    overlaps: holdings.filter((h) => h.via === 'both'),
    cost,
    concentration: concentration(positions),
  }
}
