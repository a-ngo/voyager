import { describe, expect, it } from 'vitest'
import { buildOverview, toLedger } from '@/lib/portfolio/overview'
import type { TransactionRow } from '@/lib/db/transactions'

function rowsToLedger(rows: Partial<TransactionRow>[]) {
  const full: TransactionRow[] = rows.map((r, i) => ({
    id: String(i),
    type: 'buy',
    assetClass: 'etf',
    isin: 'IE00TEST',
    ticker: null,
    name: null,
    quantity: null,
    price: null,
    amount: null,
    fee: null,
    tax: null,
    currency: 'EUR',
    date: '2024-01-01',
    datetime: '2024-01-01T00:00:00.000Z',
    ...r,
  }))
  return toLedger(full)
}

describe('buildOverview', () => {
  it('reports no data for an empty ledger', () => {
    const o = buildOverview([])
    expect(o.hasData).toBe(false)
    expect(o.positions).toEqual([])
    expect(o.allocation).toEqual([])
  })

  it('summarizes invested cost, cash, and contributions from real rows', () => {
    const o = buildOverview(
      rowsToLedger([
        { type: 'deposit', assetClass: 'cash', isin: null, amount: '2000' },
        { type: 'buy', assetClass: 'etf', isin: 'IE00ETF', quantity: '10', price: '100', amount: '-1000' },
      ]),
    )
    expect(o.hasData).toBe(true)
    expect(o.investedAtCost).toBeCloseTo(1000)
    expect(o.cash).toBeCloseTo(1000)
    expect(o.netContributions).toBeCloseTo(2000)
    expect(o.positions).toHaveLength(1)
    expect(o.positions[0]?.label).toBe('IE00ETF')
  })

  it('builds a normalized allocation whose weights sum to 100', () => {
    const o = buildOverview(
      rowsToLedger([
        { type: 'deposit', assetClass: 'cash', isin: null, amount: '5000' },
        { type: 'buy', assetClass: 'etf', isin: 'IE00ETF', quantity: '10', price: '100', amount: '-1000' },
        { type: 'buy', assetClass: 'stock', isin: 'US0378331005', quantity: '5', price: '200', amount: '-1000' },
      ]),
    )
    const sum = o.allocation.reduce((acc, s) => acc + s.weight, 0)
    expect(sum).toBeCloseTo(100)
    expect(o.allocation.every((s) => s.color.startsWith('#'))).toBe(true)
  })

  it('excludes negative cash from the allocation pie', () => {
    const o = buildOverview(
      rowsToLedger([
        { type: 'deposit', assetClass: 'cash', isin: null, amount: '500' },
        { type: 'buy', assetClass: 'etf', isin: 'IE00ETF', quantity: '10', price: '100', amount: '-1000' },
      ]),
    )
    expect(o.cash).toBeLessThan(0)
    expect(o.allocation.some((s) => s.label === 'Cash')).toBe(false)
  })
})
