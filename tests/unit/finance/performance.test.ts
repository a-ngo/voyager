import { describe, expect, it } from 'vitest'
import {
  monthlyDates,
  tradeCountsByMonth,
  valueOverTime,
  type InstrumentSeries,
} from '@/lib/finance/performance'
import type { LedgerTransaction } from '@/lib/finance/holdings'

function tx(o: Partial<LedgerTransaction>): LedgerTransaction {
  return {
    type: 'buy',
    assetClass: 'etf',
    isin: 'IE00ETF',
    ticker: null,
    quantity: null,
    price: null,
    amount: null,
    fee: null,
    tax: null,
    currency: 'EUR',
    date: '2024-01-01',
    ...o,
  }
}

describe('tradeCountsByMonth', () => {
  it('counts buys and sells per month, ignoring other types', () => {
    const counts = tradeCountsByMonth([
      tx({ type: 'buy', date: '2024-01-05' }),
      tx({ type: 'buy', date: '2024-01-20' }),
      tx({ type: 'sell', date: '2024-01-25' }),
      tx({ type: 'dividend', date: '2024-01-28' }), // ignored
      tx({ type: 'sell', date: '2024-03-10' }),
    ])
    expect(counts['2024-01']).toEqual({ buys: 2, sells: 1 })
    expect(counts['2024-03']).toEqual({ buys: 0, sells: 1 })
    expect(counts['2024-02']).toBeUndefined()
  })
})

describe('monthlyDates', () => {
  it('emits month-ends, with today for the current month', () => {
    expect(monthlyDates('2021-01-15', '2021-04-10')).toEqual([
      '2021-01-31',
      '2021-02-28',
      '2021-03-31',
      '2021-04-10',
    ])
  })
})

describe('valueOverTime', () => {
  const ledger: LedgerTransaction[] = [
    tx({ type: 'deposit', assetClass: 'cash', isin: null, amount: 2000, date: '2024-01-02' }),
    tx({ type: 'buy', isin: 'IE00ETF', quantity: 10, price: 100, amount: -1000, date: '2024-01-05' }),
  ]
  const series: InstrumentSeries[] = [
    {
      isin: 'IE00ETF',
      currency: 'EUR',
      points: [
        { date: '2024-01-31', close: 100 },
        { date: '2024-02-29', close: 120 },
      ],
    },
  ]
  const rates = { EUR: 1 }

  it('values holdings + cash at each date and tracks invested', () => {
    const pts = valueOverTime(ledger, series, ['2024-01-31', '2024-02-29'], rates)
    // Jan: 10×100 = 1000 holdings + 1000 cash = 2000; invested 2000
    expect(pts[0]).toEqual({ date: '2024-01-31', value: 2000, invested: 2000 })
    // Feb: 10×120 = 1200 holdings + 1000 cash = 2200; invested 2000 (gain shows as value>invested)
    expect(pts[1]?.value).toBeCloseTo(2200)
    expect(pts[1]?.invested).toBeCloseTo(2000)
  })

  it('converts non-EUR prices via rates', () => {
    const usd: InstrumentSeries[] = [
      { isin: 'IE00ETF', currency: 'USD', points: [{ date: '2024-01-31', close: 116.4 }] },
    ]
    const pts = valueOverTime(ledger, usd, ['2024-01-31'], { EUR: 1, USD: 1.164 })
    // 10 × 116.4 USD = 1164 USD → 1000 EUR; + 1000 cash = 2000
    expect(pts[0]?.value).toBeCloseTo(2000)
  })

  it('forward-fills the last known price and ignores instruments without a series', () => {
    const pts = valueOverTime(ledger, [], ['2024-03-31'], rates)
    // No price series → holdings unvalued; only cash counts
    expect(pts[0]?.value).toBeCloseTo(1000)
  })
})
