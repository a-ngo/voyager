import { describe, expect, it } from 'vitest'
import { parseYahooQuote, parseYahooHistory } from '@/lib/prices/yahoo'
import { toEur } from '@/lib/prices/fx'
import { resolveSymbol, displayName } from '@/lib/prices/resolve'

// 2026-06-04 17:00 UTC = 1780592400
const quotePayload = {
  chart: {
    result: [
      {
        meta: {
          currency: 'USD',
          regularMarketPrice: 310.585,
          regularMarketTime: 1780592400,
          longName: 'Apple Inc.',
          shortName: 'Apple',
        },
      },
    ],
  },
}

describe('parseYahooQuote', () => {
  it('parses the close, currency, date, and name', () => {
    expect(parseYahooQuote(quotePayload, 'AAPL')).toEqual({
      symbol: 'AAPL',
      close: 310.585,
      date: '2026-06-04',
      currency: 'USD',
      name: 'Apple Inc.',
    })
  })

  it('falls back to shortName when longName is absent', () => {
    const meta = { currency: 'EUR', regularMarketPrice: 1, regularMarketTime: 1780592400, shortName: 'X' }
    expect(parseYahooQuote({ chart: { result: [{ meta }] } }, 'X')?.name).toBe('X')
  })

  it('returns null when price or currency is missing', () => {
    expect(parseYahooQuote({ chart: { result: [{ meta: { currency: 'USD' } }] } }, 'X')).toBeNull()
    expect(parseYahooQuote({ chart: { result: [{ meta: { regularMarketPrice: 1 } }] } }, 'X')).toBeNull()
  })

  it('returns null for malformed input', () => {
    expect(parseYahooQuote({}, 'x')).toBeNull()
    expect(parseYahooQuote(null, 'x')).toBeNull()
  })
})

describe('parseYahooHistory', () => {
  it('pairs timestamps with closes, ascending, dropping nulls', () => {
    const payload = {
      chart: {
        result: [
          {
            timestamp: [1780592400, 1777939200],
            indicators: { quote: [{ close: [310.585, null] }] },
          },
        ],
      },
    }
    expect(parseYahooHistory(payload)).toEqual([{ date: '2026-06-04', close: 310.585 }])
  })

  it('returns an empty array when history is absent', () => {
    expect(parseYahooHistory({ chart: { result: [{ meta: {} }] } })).toEqual([])
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
      yahoo: 'AAPL',
      currency: 'USD',
      name: 'Apple',
    })
    expect(resolveSymbol('DE0008404005')).toEqual({
      yahoo: 'ALV.DE',
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

  it('uses an auto-pulled name for non-curated ISINs', () => {
    expect(displayName('XX0000000000', null, { XX0000000000: 'Foo Corp' })).toBe('Foo Corp')
  })

  it('keeps the curated name over an auto-pulled one', () => {
    expect(displayName('US0378331005', null, { US0378331005: 'APPLE INC' })).toBe('Apple')
  })
})
