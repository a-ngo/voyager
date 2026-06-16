import { describe, it, expect } from 'vitest'
import {
  instrumentLedgerStats,
  reconstructPortfolio,
  type LedgerTransaction,
} from '@/lib/finance/holdings'

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

describe('instrumentLedgerStats', () => {
  const ledger: LedgerTransaction[] = [
    // AAA: buy 10@100 (−1000), sell 10@120 (+1200) → closed, realized +200
    tx({ type: 'buy', isin: 'AAA', quantity: 10, amount: -1000, date: '2024-01-01' }),
    tx({ type: 'sell', isin: 'AAA', quantity: -10, amount: 1200, date: '2024-06-01' }),
    // BBB: buy 5@200 (−1000), still held, +20 dividend
    tx({ type: 'buy', isin: 'BBB', quantity: 5, amount: -1000, date: '2024-02-01' }),
    tx({ type: 'dividend', isin: 'BBB', amount: 20, date: '2024-09-01' }),
  ]

  it('keeps closed positions and attributes realized P/L and income per instrument', () => {
    const stats = instrumentLedgerStats(ledger)
    const aaa = stats.find((s) => s.isin === 'AAA')!
    const bbb = stats.find((s) => s.isin === 'BBB')!

    expect(aaa.quantity).toBe(0) // closed
    expect(aaa.costBasis).toBe(0)
    expect(aaa.realizedPnl).toBeCloseTo(200, 6)
    expect(aaa.invested).toBeCloseTo(1000, 6)

    expect(bbb.quantity).toBe(5)
    expect(bbb.costBasis).toBeCloseTo(1000, 6)
    expect(bbb.realizedPnl).toBe(0)
    expect(bbb.income).toBeCloseTo(20, 6)
  })

  it('reconciles total realized P/L with the holdings engine', () => {
    const stats = instrumentLedgerStats(ledger)
    const summary = reconstructPortfolio(ledger)
    const totalRealized = stats.reduce((s, i) => s + i.realizedPnl, 0)
    expect(totalRealized).toBeCloseTo(summary.realizedPnl, 6)
  })
})
