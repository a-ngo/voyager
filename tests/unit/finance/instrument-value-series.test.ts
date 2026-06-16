import { describe, it, expect } from 'vitest'
import {
  instrumentValueOverTime,
  valueOverTime,
  type InstrumentSeries,
} from '@/lib/finance/performance'
import type { LedgerTransaction } from '@/lib/finance/holdings'

function tx(p: Partial<LedgerTransaction>): LedgerTransaction {
  return {
    type: 'buy',
    assetClass: 'stock',
    isin: null,
    ticker: null,
    quantity: null,
    price: null,
    amount: null,
    fee: null,
    tax: null,
    currency: 'EUR',
    date: '2024-01-01',
    ...p,
  }
}

const ledger: LedgerTransaction[] = [
  tx({ type: 'deposit', amount: 3000, date: '2024-01-01' }),
  tx({ type: 'buy', isin: 'AAA', quantity: 10, amount: -1000, date: '2024-01-10' }),
  tx({ type: 'buy', isin: 'BBB', quantity: 5, amount: -1000, date: '2024-01-10' }),
  tx({ type: 'sell', isin: 'AAA', quantity: -10, amount: 1400, date: '2024-03-15' }), // closed in March
]

const series: InstrumentSeries[] = [
  {
    isin: 'AAA',
    currency: 'EUR',
    points: [
      { date: '2024-01-31', close: 110 },
      { date: '2024-02-29', close: 130 },
      { date: '2024-03-31', close: 140 },
    ],
  },
  {
    isin: 'BBB',
    currency: 'EUR',
    points: [
      { date: '2024-01-31', close: 200 },
      { date: '2024-02-29', close: 210 },
      { date: '2024-03-31', close: 220 },
    ],
  },
]

const dates = ['2024-01-31', '2024-02-29', '2024-03-31']
const rates = { USD: 1.1 }

describe('instrumentValueOverTime', () => {
  it('splits value by instrument and drops closed positions to zero', () => {
    const out = instrumentValueOverTime(ledger, series, dates, rates)
    const aaa = out.find((s) => s.isin === 'AAA')!
    const bbb = out.find((s) => s.isin === 'BBB')!

    expect(aaa.values).toEqual([1100, 1300, 0]) // 10×110, 10×130, sold before March close
    expect(bbb.values).toEqual([1000, 1050, 1100]) // 5×200, 5×210, 5×220
  })

  it('per-instrument values sum to the portfolio value minus cash', () => {
    const per = instrumentValueOverTime(ledger, series, dates, rates)
    const total = valueOverTime(ledger, series, dates, rates)
    dates.forEach((_, di) => {
      const summed = per.reduce((s, inst) => s + inst.values[di]!, 0)
      // total includes cash; subtract it to compare holdings value
      // cash after Jan: 3000 − 1000 − 1000 = 1000; after the March sell: +1400 = 2400
      const cash = di < 2 ? 1000 : 2400
      expect(summed).toBeCloseTo(total[di]!.value - cash, 6)
    })
  })
})
