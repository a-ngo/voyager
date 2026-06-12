import { describe, expect, it } from 'vitest'
import {
  concentration,
  countryAllocation,
  currencyExposure,
  lookThroughHoldings,
  sectorAllocation,
  type InstrumentProfile,
  type XrayPosition,
} from '@/lib/finance/xray'

function pos(o: Partial<XrayPosition>): XrayPosition {
  return { key: 'k', name: 'X', symbol: 'X', assetClass: 'stock', eurValue: 0, ...o }
}

const worldEtf: InstrumentProfile = {
  isFund: true,
  sectorWeights: { technology: 0.25, financial_services: 0.15 },
  holdings: [
    { symbol: 'AAPL', name: 'Apple', weight: 0.05 },
    { symbol: 'MSFT', name: 'Microsoft', weight: 0.04 },
  ],
  country: null,
  sector: null,
}
const appleStock: InstrumentProfile = {
  isFund: false,
  sectorWeights: {},
  holdings: [],
  country: 'United States',
  sector: 'Technology',
}

describe('lookThroughHoldings', () => {
  it('scales fund holdings and merges with direct positions, flagging overlap', () => {
    const positions = [
      pos({ key: 'etf', name: 'World ETF', symbol: 'IWDA.AS', assetClass: 'etf', eurValue: 1000 }),
      pos({ key: 'aapl', name: 'Apple', symbol: 'AAPL', assetClass: 'stock', eurValue: 100 }),
    ]
    const profiles = new Map([
      ['IWDA.AS', worldEtf],
      ['AAPL', appleStock],
    ])
    const out = lookThroughHoldings(positions, profiles)
    const aapl = out.find((h) => h.symbol === 'AAPL')!
    // 100 direct + 0.05 * 1000 = 150 total
    expect(aapl.value).toBeCloseTo(150)
    expect(aapl.directValue).toBeCloseTo(100)
    expect(aapl.fundValue).toBeCloseTo(50)
    expect(aapl.via).toBe('both')
    const msft = out.find((h) => h.symbol === 'MSFT')!
    expect(msft.value).toBeCloseTo(40)
    expect(msft.via).toBe('fund')
  })
})

describe('sectorAllocation', () => {
  it('looks through funds and adds direct stock sectors', () => {
    const positions = [
      pos({ symbol: 'IWDA.AS', assetClass: 'etf', eurValue: 1000 }),
      pos({ symbol: 'AAPL', assetClass: 'stock', eurValue: 200 }),
    ]
    const profiles = new Map([
      ['IWDA.AS', worldEtf],
      ['AAPL', appleStock],
    ])
    const { slices, coverage } = sectorAllocation(positions, profiles)
    const tech = slices.find((s) => s.label === 'Technology')!
    // fund: 0.25*1000 = 250; stock: 200 → 450
    expect(tech.value).toBeCloseTo(450)
    // classified = 250 + 150 (fin) + 200 = 600 of 1200
    expect(coverage).toBeCloseTo(0.5)
  })
})

describe('countryAllocation + currencyExposure', () => {
  it('aggregates by country and maps to currency with coverage', () => {
    const holdings = [
      { symbol: 'AAPL', name: 'Apple', value: 100, weight: 0, directValue: 100, fundValue: 0, via: 'direct' as const, sector: null },
      { symbol: 'SAP', name: 'SAP', value: 50, weight: 0, directValue: 50, fundValue: 0, via: 'direct' as const, sector: null },
      { symbol: 'XXX', name: 'Unknown', value: 50, weight: 0, directValue: 50, fundValue: 0, via: 'direct' as const, sector: null },
    ]
    const countryBySymbol = new Map([
      ['AAPL', 'United States'],
      ['SAP', 'Germany'],
    ])
    const countries = countryAllocation(holdings, countryBySymbol, 200)
    expect(countries.slices.find((s) => s.label === 'United States')?.value).toBeCloseTo(100)
    expect(countries.coverage).toBeCloseTo(0.75) // 150 of 200 classified

    const ccy = currencyExposure(countries, 200)
    expect(ccy.slices.find((s) => s.label === 'USD')?.value).toBeCloseTo(100)
    expect(ccy.slices.find((s) => s.label === 'EUR')?.value).toBeCloseTo(50)
  })
})

describe('concentration', () => {
  it('computes top-10, largest, and effective holdings', () => {
    const positions = [
      pos({ eurValue: 600 }),
      pos({ eurValue: 300 }),
      pos({ eurValue: 100 }),
    ]
    const c = concentration(positions)
    expect(c.holdings).toBe(3)
    expect(c.largestWeight).toBeCloseTo(60)
    expect(c.top10Weight).toBeCloseTo(100)
    // HHI = .36+.09+.01 = .46 → 1/.46 ≈ 2.17
    expect(c.effectiveHoldings).toBeCloseTo(2.174, 2)
  })
})
