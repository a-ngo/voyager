import { describe, it, expect } from 'vitest'
import { portfolioCost } from '@/lib/finance/cost'

describe('portfolioCost', () => {
  it('returns zeros for an empty portfolio', () => {
    expect(portfolioCost([])).toEqual({ weightedTerPct: 0, annualCost: 0, coverage: 0, funds: [] })
  })

  it('reports no cost for fee-free holdings (stocks)', () => {
    const r = portfolioCost([
      { name: 'Apple', value: 6000, ter: 0 },
      { name: 'Cash', value: 4000, ter: 0 },
    ])
    expect(r.annualCost).toBe(0)
    expect(r.weightedTerPct).toBe(0)
    expect(r.coverage).toBe(1)
    expect(r.funds).toEqual([])
  })

  it('blends fund TERs weighted by value and lists funds by cost', () => {
    const r = portfolioCost([
      { name: 'World ETF', value: 5000, ter: 0.002 }, // €10/yr
      { name: 'EM ETF', value: 3000, ter: 0.0007 }, // €2.10/yr
      { name: 'Apple', value: 2000, ter: 0 },
    ])
    expect(r.annualCost).toBeCloseTo(12.1, 6)
    expect(r.weightedTerPct).toBeCloseTo(0.121, 6) // 12.1 / 10000 × 100
    expect(r.coverage).toBe(1)
    expect(r.funds.map((f) => f.name)).toEqual(['World ETF', 'EM ETF']) // largest cost first
    expect(r.funds[0]).toMatchObject({ terPct: 0.2, annualCost: 10 })
  })

  it('excludes funds with unknown TER and lowers coverage', () => {
    const r = portfolioCost([
      { name: 'World ETF', value: 5000, ter: 0.002 },
      { name: 'Mystery fund', value: 3000, ter: null }, // unknown
      { name: 'Apple', value: 2000, ter: 0 },
    ])
    expect(r.annualCost).toBeCloseTo(10, 6)
    expect(r.coverage).toBeCloseTo(0.7, 6) // (5000 + 2000) / 10000
    expect(r.funds).toHaveLength(1)
  })
})
