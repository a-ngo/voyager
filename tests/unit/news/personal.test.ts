import { describe, it, expect } from 'vitest'
import { buildQueries, queryUrl } from '@/lib/news/queries'
import { parseRanking, rankByRecency, sortRanked } from '@/lib/news/rank'
import type { RankedNewsItem } from '@/lib/news/types'

function item(over: Partial<RankedNewsItem>): RankedNewsItem {
  return {
    title: 't',
    url: `https://x/${Math.random()}`,
    source: 's',
    publishedAt: '2026-06-10T00:00:00.000Z',
    summary: null,
    bucket: 'holding',
    relatedTo: 'X',
    relevance: 'medium',
    why: null,
    ...over,
  }
}

describe('buildQueries', () => {
  it('takes top holdings by value (with tickers), sectors, and macro', () => {
    const queries = buildQueries({
      holdings: [
        { name: 'Apple', ticker: 'AAPL', marketValue: 100 },
        { name: 'Cash', ticker: null, marketValue: 999 }, // no ticker → dropped
        { name: 'Allianz', ticker: 'ALV.DE', marketValue: 50 },
      ],
      sectors: ['Technology', 'Financial Services'],
    })
    const holdings = queries.filter((q) => q.bucket === 'holding')
    expect(holdings.map((q) => q.term)).toEqual(['AAPL', 'ALV.DE']) // sorted by value, Cash dropped
    expect(queries.some((q) => q.bucket === 'sector' && q.relatedTo === 'Technology')).toBe(true)
    expect(queries.filter((q) => q.bucket === 'macro').length).toBeGreaterThan(0)
  })
})

describe('queryUrl', () => {
  it('uses Yahoo per-symbol RSS for holdings and Google News for the rest', () => {
    expect(queryUrl({ bucket: 'holding', relatedTo: 'Apple', kind: 'yahoo', term: 'AAPL' })).toContain(
      'feeds.finance.yahoo.com/rss/2.0/headline?s=AAPL',
    )
    const g = queryUrl({ bucket: 'macro', relatedTo: 'Macro', kind: 'google', term: 'inflation outlook' })
    expect(g).toContain('news.google.com/rss/search')
    expect(g).toContain(encodeURIComponent('inflation outlook when:3d'))
  })
})

describe('parseRanking', () => {
  it('extracts a JSON array even when wrapped in prose', () => {
    const text = 'Here are the relevant ones:\n[{"index":2,"relevance":"high","why":"Directly about Apple."}]\nHope that helps.'
    expect(parseRanking(text)).toEqual([{ index: 2, relevance: 'high', why: 'Directly about Apple.' }])
  })

  it('accepts the i alias, defaults bad relevance to medium, and skips non-integer indices', () => {
    const text = '[{"i":0,"relevance":"weird"},{"index":1.5,"relevance":"low"},{"index":3,"why":"x"}]'
    expect(parseRanking(text)).toEqual([
      { index: 0, relevance: 'medium', why: '' },
      { index: 3, relevance: 'medium', why: 'x' },
    ])
  })

  it('returns [] for non-JSON', () => {
    expect(parseRanking('no json here')).toEqual([])
  })
})

describe('rankByRecency', () => {
  it('orders by bucket (holding→sector→macro) then recency', () => {
    const items = [
      item({ bucket: 'macro', publishedAt: '2026-06-12T00:00:00.000Z' }),
      item({ bucket: 'holding', publishedAt: '2026-06-09T00:00:00.000Z' }),
      item({ bucket: 'holding', publishedAt: '2026-06-11T00:00:00.000Z' }),
    ]
    const out = rankByRecency(items)
    expect(out.map((i) => i.bucket)).toEqual(['holding', 'holding', 'macro'])
    expect(out[0]!.publishedAt).toBe('2026-06-11T00:00:00.000Z') // newer holding first
  })
})

describe('sortRanked', () => {
  it('orders by relevance first', () => {
    const out = sortRanked([
      item({ relevance: 'low' }),
      item({ relevance: 'high' }),
      item({ relevance: 'medium' }),
    ])
    expect(out.map((i) => i.relevance)).toEqual(['high', 'medium', 'low'])
  })
})
