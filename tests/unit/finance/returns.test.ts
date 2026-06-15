import { describe, expect, it } from 'vitest'
import {
  cashflowsFromSeries,
  moneyWeightedReturn,
  riskMetrics,
  timeWeightedReturn,
} from '@/lib/finance/returns'

describe('timeWeightedReturn', () => {
  it('returns the simple growth when there are no contributions', () => {
    const r = timeWeightedReturn([
      { date: '2024-01-01', value: 1000, invested: 1000 },
      { date: '2024-02-01', value: 1100, invested: 1000 },
    ])
    expect(r?.cumulative).toBeCloseTo(0.1)
  })

  it('neutralizes a mid-series contribution', () => {
    // Month 1: 1000 → 1100 (+10%). Month 2: +1000 contributed, 2100 → 2310 is
    // not tested here; here end is 2100 with no growth after the contribution.
    const r = timeWeightedReturn([
      { date: '2024-01-01', value: 1000, invested: 1000 },
      { date: '2024-02-01', value: 1100, invested: 1000 }, // +10%
      { date: '2024-03-01', value: 2100, invested: 2000 }, // +1000 in, flat
    ])
    // growth = 1.10 * (2100 / (1100 + 1000)) = 1.10 * 1.0 = 1.10
    expect(r?.cumulative).toBeCloseTo(0.1)
  })

  it('chains two positive periods', () => {
    const r = timeWeightedReturn([
      { date: '2024-01-01', value: 100, invested: 100 },
      { date: '2024-02-01', value: 110, invested: 100 }, // +10%
      { date: '2024-03-01', value: 121, invested: 100 }, // +10%
    ])
    expect(r?.cumulative).toBeCloseTo(0.21)
  })

  it('returns null for fewer than two points', () => {
    expect(timeWeightedReturn([{ date: '2024-01-01', value: 100, invested: 100 }])).toBeNull()
  })
})

describe('moneyWeightedReturn', () => {
  it('solves a simple one-year 10% IRR', () => {
    const irr = moneyWeightedReturn([
      { date: '2024-01-01', amount: -1000 },
      { date: '2025-01-01', amount: 1100 },
    ])
    expect(irr).toBeCloseTo(0.1, 3)
  })

  it('handles intermediate contributions', () => {
    // Invest 1000, add 1000 after a year, worth 2200 a year later.
    const irr = moneyWeightedReturn([
      { date: '2024-01-01', amount: -1000 },
      { date: '2025-01-01', amount: -1000 },
      { date: '2026-01-01', amount: 2200 },
    ])
    expect(irr).not.toBeNull()
    expect(irr!).toBeGreaterThan(0)
    expect(irr!).toBeLessThan(0.15)
  })

  it('returns null when all flows share a sign (no IRR)', () => {
    expect(
      moneyWeightedReturn([
        { date: '2024-01-01', amount: -1000 },
        { date: '2025-01-01', amount: -500 },
      ]),
    ).toBeNull()
  })
})

describe('cashflowsFromSeries', () => {
  it('buys in at the first value, books contributions, receives the final value', () => {
    const flows = cashflowsFromSeries([
      { date: '2024-01-01', value: 1000, invested: 1000 },
      { date: '2024-02-01', value: 1100, invested: 1000 },
      { date: '2024-03-01', value: 2200, invested: 2000 },
    ])
    expect(flows[0]).toEqual({ date: '2024-01-01', amount: -1000 }) // buy in
    expect(flows).toContainEqual({ date: '2024-03-01', amount: -1000 }) // contribution
    expect(flows.at(-1)).toEqual({ date: '2024-03-01', amount: 2200 }) // terminal value
  })
})

describe('riskMetrics', () => {
  it('returns null with too few points', () => {
    expect(riskMetrics([{ date: '2024-01-01', value: 100, invested: 100 }])).toBeNull()
    expect(
      riskMetrics([
        { date: '2024-01-01', value: 100, invested: 100 },
        { date: '2024-02-01', value: 110, invested: 100 },
      ]),
    ).toBeNull()
  })

  it('reports zero volatility and drawdown for a flat series', () => {
    const flat = [
      { date: '2024-01-01', value: 100, invested: 100 },
      { date: '2024-02-01', value: 100, invested: 100 },
      { date: '2024-03-01', value: 100, invested: 100 },
    ]
    const r = riskMetrics(flat)!
    expect(r.volatility).toBeCloseTo(0, 6)
    expect(r.maxDrawdown).toBeCloseTo(0, 6)
    expect(r.sharpe).toBeNull() // zero volatility → undefined Sharpe
  })

  it('computes max drawdown on the contribution-neutral index', () => {
    // growth 1.2, 0.75, 1.222 → index 1.2, 0.9, 1.1 → peak 1.2, trough 0.9
    const r = riskMetrics([
      { date: '2024-01-01', value: 100, invested: 100 },
      { date: '2024-02-01', value: 120, invested: 100 },
      { date: '2024-03-01', value: 90, invested: 100 },
      { date: '2024-04-01', value: 110, invested: 100 },
    ])!
    expect(r.maxDrawdown).toBeCloseTo(0.25, 4)
    expect(r.volatility).toBeGreaterThan(0)
  })

  it('ignores contributions when measuring drawdown', () => {
    // Value only rises because of a deposit; no investment loss → no drawdown.
    const r = riskMetrics([
      { date: '2024-01-01', value: 100, invested: 100 },
      { date: '2024-02-01', value: 200, invested: 200 }, // +100 deposit, flat performance
      { date: '2024-03-01', value: 300, invested: 300 },
    ])!
    expect(r.maxDrawdown).toBeCloseTo(0, 6)
  })
})
