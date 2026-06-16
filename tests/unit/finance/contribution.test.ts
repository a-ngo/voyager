import { describe, it, expect } from 'vitest'
import { decomposeContributions, type IncomeEvent } from '@/lib/finance/contribution'
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

  it('splits market return into price and income', () => {
    const points: ValuePoint[] = [
      { date: '2023-01-01', value: 1000, invested: 1000 },
      { date: '2023-07-01', value: 1080, invested: 1000 }, // +80 market (incl. a 30 dividend)
      { date: '2024-01-01', value: 1200, invested: 1000 }, // +120 market (incl. a 20 dividend)
    ]
    const income: IncomeEvent[] = [
      { date: '2023-06-15', amount: 30 },
      { date: '2024-12-10', amount: 20 },
    ]
    const d = decomposeContributions(points, income)!

    expect(d.marketGain).toBe(200) // 1200 − 1000
    expect(d.income).toBe(50)
    expect(d.priceGain).toBe(150) // 200 − 50
    // price + income reconstructs market gain
    expect(d.priceGain + d.income).toBeCloseTo(d.marketGain, 6)
    // per-year: pricePnl + income = marketPnl, and sums match totals
    for (const p of d.periods) expect(p.pricePnl + p.income).toBeCloseTo(p.marketPnl, 6)
    expect(d.periods.reduce((s, p) => s + p.income, 0)).toBeCloseTo(50, 6)
    expect(d.periods.reduce((s, p) => s + p.pricePnl, 0)).toBeCloseTo(150, 6)
    expect(d.periods[0]).toMatchObject({ period: '2023', income: 30 })
    expect(d.periods[1]).toMatchObject({ period: '2024', income: 20 })
  })

  it('defaults income to zero when no events are given', () => {
    const points: ValuePoint[] = [
      { date: '2023-01-01', value: 1000, invested: 1000 },
      { date: '2024-01-01', value: 1100, invested: 1000 },
    ]
    const d = decomposeContributions(points)!
    expect(d.income).toBe(0)
    expect(d.priceGain).toBe(d.marketGain)
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
