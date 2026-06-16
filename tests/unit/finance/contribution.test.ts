import { describe, it, expect } from 'vitest'
import { decomposeContributions } from '@/lib/finance/contribution'
import type { ValuePoint } from '@/lib/finance/returns'

describe('decomposeContributions', () => {
  it('returns null for fewer than two points', () => {
    expect(decomposeContributions([])).toBeNull()
    expect(decomposeContributions([{ date: '2024-01-01', value: 100, invested: 100 }])).toBeNull()
  })

  it('splits value into contributions and market gain', () => {
    const points: ValuePoint[] = [
      { date: '2023-01-01', value: 1000, invested: 1000 },
      { date: '2024-01-01', value: 1100, invested: 1000 }, // +100 market, no new money
    ]
    const d = decomposeContributions(points)!
    expect(d.contributions).toBe(1000)
    expect(d.marketGain).toBe(100)
    expect(d.endValue).toBe(1100)
    expect(d.marketShare).toBeCloseTo(100 / 1100, 6)
  })

  it('attributes per year and the per-year figures sum to the totals', () => {
    const points: ValuePoint[] = [
      { date: '2023-01-01', value: 1000, invested: 1000 },
      { date: '2023-07-01', value: 1300, invested: 1200 }, // +200 in, +100 market
      { date: '2024-01-01', value: 1250, invested: 1200 }, // −50 market
      { date: '2024-07-01', value: 1600, invested: 1500 }, // +300 in, +100 market
    ]
    const d = decomposeContributions(points)!

    expect(d.contributions).toBe(1500)
    expect(d.marketGain).toBe(100) // 1600 − 1500
    expect(d.periods.map((p) => p.period)).toEqual(['2023', '2024'])

    const sumContrib = d.periods.reduce((s, p) => s + p.contribution, 0)
    const sumMarket = d.periods.reduce((s, p) => s + p.marketPnl, 0)
    expect(sumContrib).toBeCloseTo(d.contributions, 6)
    expect(sumMarket).toBeCloseTo(d.marketGain, 6)

    expect(d.periods[0]).toMatchObject({ period: '2023', contribution: 1200, marketPnl: 100 })
    // 2024: market −50 (Jan) then +50 (Jul) nets to 0; contributions 300 (Jul)
    expect(d.periods[1]).toMatchObject({ period: '2024', contribution: 300, marketPnl: 0 })
  })

  it('handles a net market loss', () => {
    const points: ValuePoint[] = [
      { date: '2023-01-01', value: 1000, invested: 1000 },
      { date: '2024-01-01', value: 800, invested: 1000 },
    ]
    const d = decomposeContributions(points)!
    expect(d.marketGain).toBe(-200)
    expect(d.marketShare).toBeCloseTo(-200 / 800, 6)
  })

  it('handles a net withdrawal year (negative contribution)', () => {
    const points: ValuePoint[] = [
      { date: '2023-01-01', value: 1000, invested: 1000 },
      { date: '2024-01-01', value: 700, invested: 600 }, // withdrew 400, +100 market
    ]
    const d = decomposeContributions(points)!
    expect(d.contributions).toBe(600)
    expect(d.periods[1]).toMatchObject({ period: '2024', contribution: -400, marketPnl: 100 })
  })
})
