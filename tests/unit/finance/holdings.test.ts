import { describe, expect, it } from 'vitest'
import {
  allocationByAssetClass,
  reconstructPortfolio,
  totalReturn,
  valuePortfolio,
  type LedgerTransaction,
} from '@/lib/finance/holdings'

function tx(overrides: Partial<LedgerTransaction>): LedgerTransaction {
  return {
    type: 'buy',
    assetClass: 'etf',
    isin: 'IE00TEST',
    ticker: null,
    quantity: null,
    price: null,
    amount: null,
    fee: null,
    tax: null,
    currency: 'EUR',
    date: '2024-01-01',
    ...overrides,
  }
}

describe('reconstructPortfolio', () => {
  it('returns zeros for an empty ledger', () => {
    const s = reconstructPortfolio([])
    expect(s.positions).toEqual([])
    expect(s.cash).toBe(0)
    expect(s.netContributions).toBe(0)
    expect(s.income).toBe(0)
    expect(s.fees).toBe(0)
    expect(s.realizedPnl).toBe(0)
  })

  it('tracks cash and net contributions for deposits and withdrawals', () => {
    const s = reconstructPortfolio([
      tx({ type: 'deposit', amount: 2000, assetClass: 'cash', isin: null }),
      tx({ type: 'withdrawal', amount: 500, assetClass: 'cash', isin: null }),
    ])
    expect(s.cash).toBeCloseTo(1500)
    expect(s.netContributions).toBeCloseTo(1500)
    expect(s.positions).toEqual([])
  })

  it('capitalizes buy fees into cost basis and reduces cash', () => {
    const s = reconstructPortfolio([
      tx({ type: 'deposit', amount: 2000, assetClass: 'cash', isin: null }),
      tx({ type: 'buy', quantity: 10, price: 100, fee: 1 }),
    ])
    const pos = s.positions[0]
    expect(pos?.quantity).toBeCloseTo(10)
    expect(pos?.costBasis).toBeCloseTo(1001)
    expect(pos?.averageCost).toBeCloseTo(100.1)
    expect(s.cash).toBeCloseTo(999)
    expect(s.fees).toBeCloseTo(1)
  })

  it('uses average cost across multiple buys', () => {
    const s = reconstructPortfolio([
      tx({ type: 'buy', quantity: 10, price: 100 }),
      tx({ type: 'buy', quantity: 10, price: 120 }),
    ])
    const pos = s.positions[0]
    expect(pos?.quantity).toBeCloseTo(20)
    expect(pos?.costBasis).toBeCloseTo(2200)
    expect(pos?.averageCost).toBeCloseTo(110)
  })

  it('computes realized P/L on a partial sell and keeps the remainder', () => {
    const s = reconstructPortfolio([
      tx({ type: 'buy', quantity: 10, price: 100 }),
      tx({ type: 'buy', quantity: 10, price: 120 }), // avg 110
      tx({ type: 'sell', quantity: 5, price: 130 }), // proceeds 650, cost 550
    ])
    const pos = s.positions[0]
    expect(pos?.quantity).toBeCloseTo(15)
    expect(pos?.costBasis).toBeCloseTo(1650)
    expect(pos?.realizedPnl).toBeCloseTo(100)
    expect(s.realizedPnl).toBeCloseTo(100)
  })

  it('closes a position fully sold and keeps its realized P/L in the summary', () => {
    const s = reconstructPortfolio([
      tx({ type: 'buy', quantity: 10, price: 100 }),
      tx({ type: 'sell', quantity: 10, price: 130 }),
    ])
    expect(s.positions).toEqual([]) // flat, excluded from open positions
    expect(s.realizedPnl).toBeCloseTo(300)
  })

  it('subtracts sell fees and taxes from proceeds', () => {
    const s = reconstructPortfolio([
      tx({ type: 'buy', quantity: 10, price: 100 }),
      tx({ type: 'sell', quantity: 10, price: 130, fee: 2, tax: 8 }),
    ])
    // proceeds = 1300 - 2 - 8 = 1290; cost 1000 → realized 290
    expect(s.realizedPnl).toBeCloseTo(290)
    expect(s.fees).toBeCloseTo(2)
  })

  it('treats dividends, interest, and tax refunds as income', () => {
    const s = reconstructPortfolio([
      tx({ type: 'dividend', amount: 50, isin: 'IE00TEST' }),
      tx({ type: 'interest', amount: 5, assetClass: 'cash', isin: null }),
      tx({ type: 'tax_refund', amount: 12, assetClass: 'cash', isin: null }),
    ])
    expect(s.income).toBeCloseTo(67)
    expect(s.cash).toBeCloseTo(67)
    expect(s.positions).toEqual([]) // income alone creates no position
  })

  it('adds free shares for a reward with a quantity at zero cost', () => {
    const s = reconstructPortfolio([
      tx({ type: 'reward', quantity: 1, price: 0, isin: 'US0000REWARD', assetClass: 'stock' }),
    ])
    const pos = s.positions[0]
    expect(pos?.quantity).toBeCloseTo(1)
    expect(pos?.costBasis).toBeCloseTo(0)
    expect(s.cash).toBeCloseTo(0)
  })

  it('treats a reward without a quantity as cash income', () => {
    const s = reconstructPortfolio([
      tx({ type: 'reward', amount: 15, assetClass: 'cash', isin: null }),
    ])
    expect(s.cash).toBeCloseTo(15)
    expect(s.income).toBeCloseTo(15)
    expect(s.positions).toEqual([])
  })

  it('ignores the stored sign of amount (drives off type)', () => {
    const s = reconstructPortfolio([
      tx({ type: 'withdrawal', amount: -500, assetClass: 'cash', isin: null }),
    ])
    expect(s.cash).toBeCloseTo(-500)
  })
})

describe('valuePortfolio', () => {
  const summary = reconstructPortfolio([
    tx({ type: 'deposit', amount: 2000, assetClass: 'cash', isin: null }),
    tx({ type: 'buy', quantity: 10, price: 100, isin: 'IE00TEST' }),
  ])

  it('values positions and computes unrealized P/L and net worth', () => {
    const v = valuePortfolio(summary, { IE00TEST: 120 })
    const pos = v.positions[0]
    expect(pos?.marketValue).toBeCloseTo(1200)
    expect(pos?.unrealizedPnl).toBeCloseTo(200)
    expect(v.holdingsValue).toBeCloseTo(1200)
    expect(v.cash).toBeCloseTo(1000)
    expect(v.netWorth).toBeCloseTo(2200)
    expect(v.unpricedCount).toBe(0)
  })

  it('falls back to a ticker price when ISIN is absent', () => {
    const s = reconstructPortfolio([tx({ type: 'buy', quantity: 2, price: 50, isin: null, ticker: 'AAPL' })])
    const v = valuePortfolio(s, { AAPL: 75 })
    expect(v.positions[0]?.marketValue).toBeCloseTo(150)
  })

  it('flags unpriced positions and excludes them from holdings value', () => {
    const v = valuePortfolio(summary, {})
    expect(v.unpricedCount).toBe(1)
    expect(v.positions[0]?.priced).toBe(false)
    expect(v.positions[0]?.marketValue).toBeNull()
    expect(v.holdingsValue).toBeCloseTo(0)
    expect(v.netWorth).toBeCloseTo(1000) // cash only
  })
})

describe('allocationByAssetClass', () => {
  it('aggregates by asset class with a cash bucket, sorted by value', () => {
    const summary = reconstructPortfolio([
      tx({ type: 'deposit', amount: 5000, assetClass: 'cash', isin: null }),
      tx({ type: 'buy', quantity: 10, price: 100, isin: 'IE00ETF', assetClass: 'etf' }),
      tx({ type: 'buy', quantity: 1, price: 200, isin: 'BTCXXX', assetClass: 'crypto' }),
    ])
    const v = valuePortfolio(summary, { IE00ETF: 100, BTCXXX: 200 })
    // holdings: etf 1000, crypto 200; cash 3800; netWorth 5000
    const slices = allocationByAssetClass(v)
    expect(slices[0]?.bucket).toBe('cash')
    expect(slices[0]?.weight).toBeCloseTo(76)
    const etf = slices.find((s) => s.bucket === 'etf')
    expect(etf?.value).toBeCloseTo(1000)
    expect(etf?.weight).toBeCloseTo(20)
  })

  it('buckets positions without an asset class as "other"', () => {
    const s = reconstructPortfolio([tx({ type: 'buy', quantity: 1, price: 100, assetClass: null })])
    const v = valuePortfolio(s, { IE00TEST: 100 })
    const slices = allocationByAssetClass(v)
    expect(slices.some((sl) => sl.bucket === 'other')).toBe(true)
  })
})

describe('totalReturn', () => {
  it('computes absolute and percentage return over net contributions', () => {
    const summary = reconstructPortfolio([
      tx({ type: 'deposit', amount: 1000, assetClass: 'cash', isin: null }),
      tx({ type: 'buy', quantity: 10, price: 100, isin: 'IE00TEST' }),
    ])
    const v = valuePortfolio(summary, { IE00TEST: 130 })
    const r = totalReturn(v, summary)
    expect(r.currentValue).toBeCloseTo(1300) // 1300 holdings + 0 cash
    expect(r.netContributions).toBeCloseTo(1000)
    expect(r.absoluteReturn).toBeCloseTo(300)
    expect(r.returnPct).toBeCloseTo(30)
  })

  it('returns 0% when there are no net contributions', () => {
    const summary = reconstructPortfolio([])
    const v = valuePortfolio(summary, {})
    const r = totalReturn(v, summary)
    expect(r.returnPct).toBe(0)
    expect(r.absoluteReturn).toBe(0)
  })
})
