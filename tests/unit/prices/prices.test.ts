import { describe, expect, it } from 'vitest'
import { parseStooqCsv } from '@/lib/prices/stooq'
import { toEur } from '@/lib/prices/fx'
import { resolveSymbol, displayName } from '@/lib/prices/resolve'

describe('parseStooqCsv', () => {
  const header = 'Symbol,Date,Time,Open,High,Low,Close,Volume'

  it('parses the close and date', () => {
    const q = parseStooqCsv(`${header}\nAAPL.US,2026-06-04,17:00:24,313,313,309,310.585,7528092`, 'aapl.us')
    expect(q).toEqual({ symbol: 'aapl.us', close: 310.585, date: '2026-06-04' })
  })

  it('returns null for N/D (unknown symbol)', () => {
    expect(parseStooqCsv(`${header}\nXXX,N/D,N/D,N/D,N/D,N/D,N/D,N/D`, 'xxx')).toBeNull()
  })

  it('returns null for malformed input', () => {
    expect(parseStooqCsv('garbage', 'x')).toBeNull()
  })
})

describe('toEur', () => {
  const rates = { EUR: 1, USD: 1.164, GBP: 0.8649 }

  it('passes EUR through unchanged', () => {
    expect(toEur(100, 'EUR', rates)).toBe(100)
  })

  it('converts USD to EUR by dividing by the EUR→USD rate', () => {
    expect(toEur(116.4, 'USD', rates)).toBeCloseTo(100)
  })

  it('converts GBP to EUR', () => {
    expect(toEur(86.49, 'GBP', rates)).toBeCloseTo(100)
  })

  it('returns null when the rate is unknown', () => {
    expect(toEur(100, 'JPY', rates)).toBeNull()
  })
})

describe('resolveSymbol', () => {
  it('resolves known ISINs with their quote currency and name', () => {
    expect(resolveSymbol('US0378331005')).toEqual({
      stooq: 'aapl.us',
      currency: 'USD',
      name: 'Apple',
    })
    expect(resolveSymbol('DE0008404005')).toEqual({
      stooq: 'alv.de',
      currency: 'EUR',
      name: 'Allianz',
    })
  })

  it('returns null for unknown or missing ISINs', () => {
    expect(resolveSymbol('XX0000000000')).toBeNull()
    expect(resolveSymbol(null)).toBeNull()
  })
})

describe('displayName', () => {
  it('uses the curated name for known ISINs', () => {
    expect(displayName('IE00B4L5Y983', null)).toBe('iShares Core MSCI World')
  })

  it('falls back to ticker, then ISIN, then dash', () => {
    expect(displayName('XX0000000000', 'TSLA')).toBe('TSLA')
    expect(displayName('XX0000000000', null)).toBe('XX0000000000')
    expect(displayName(null, null)).toBe('—')
  })
})
