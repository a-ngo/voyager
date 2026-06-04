import { describe, expect, it } from 'vitest'
import { selectCandidates } from '@/lib/prices/figi-select'

// Shapes mirror real OpenFIGI /v3/mapping `data` items.
const sap = [
  { exchCode: 'GY', ticker: 'SAP', name: 'SAP SE' },
  { exchCode: 'GR', ticker: 'SAP', name: 'SAP SE' },
  { exchCode: 'US', ticker: 'SAPGF', name: 'SAP SE' },
]
const tesla = [
  { exchCode: 'GY', ticker: 'TL0', name: 'TESLA INC' },
  { exchCode: 'UW', ticker: 'TSLA', name: 'TESLA INC' },
  { exchCode: 'LN', ticker: '0R0X', name: 'TESLA INC' },
]

describe('selectCandidates', () => {
  it('prefers the German EUR listing for a DE-domiciled ISIN', () => {
    const c = selectCandidates('DE0007164600', sap)
    expect(c[0]).toEqual({ stooq: 'sap.de', currency: 'EUR', name: 'SAP SE' })
  })

  it('prefers the US listing for a US-domiciled ISIN, with EUR fallback', () => {
    const c = selectCandidates('US88160R1014', tesla)
    expect(c[0]).toEqual({ stooq: 'tsla.us', currency: 'USD', name: 'TESLA INC' })
    // German listing (tl0.de) offered as a later candidate
    expect(c.some((x) => x.stooq === 'tl0.de' && x.currency === 'EUR')).toBe(true)
  })

  it('orders EUR listings first for an EU fund ISIN', () => {
    const etf = [
      { exchCode: 'LN', ticker: 'VWRL', name: 'VANGUARD FTSE AW' },
      { exchCode: 'GY', ticker: 'VGWL', name: 'VANGUARD FTSE AW' },
    ]
    const c = selectCandidates('IE00B3RBWM25', etf)
    expect(c[0]?.stooq).toBe('vgwl.de')
    expect(c[0]?.currency).toBe('EUR')
  })

  it('de-duplicates and sanitizes class-share tickers', () => {
    const c = selectCandidates('US0000000000', [{ exchCode: 'UN', ticker: 'BRK/B', name: 'BERKSHIRE' }])
    expect(c[0]?.stooq).toBe('brk-b.us')
  })

  it('returns nothing when no exchange matches', () => {
    expect(selectCandidates('US0000000000', [{ exchCode: 'ZZ', ticker: 'X' }])).toEqual([])
  })
})
