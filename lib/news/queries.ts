import type { NewsBucket } from './types'

/**
 * Build news queries from a portfolio. Pure (no fetch), so it's unit-testable.
 * Holdings → per-symbol Yahoo RSS; sectors + macro → Google News search.
 */

export interface NewsQuery {
  bucket: NewsBucket
  /** Holding name, sector, or "Macro" — carried onto resulting items. */
  relatedTo: string
  kind: 'yahoo' | 'google'
  term: string
}

export interface QueryInputs {
  holdings: { name: string; ticker: string | null; marketValue: number }[]
  sectors: string[]
}

const MACRO_TOPICS = [
  'ECB interest rates',
  'Federal Reserve interest rates',
  'inflation outlook',
]
const MAX_HOLDINGS = 6
const MAX_SECTORS = 3

export function buildQueries({ holdings, sectors }: QueryInputs): NewsQuery[] {
  const queries: NewsQuery[] = []

  const topHoldings = holdings
    .filter((h): h is QueryInputs['holdings'][number] & { ticker: string } => Boolean(h.ticker))
    .sort((a, b) => b.marketValue - a.marketValue)
    .slice(0, MAX_HOLDINGS)
  for (const h of topHoldings) {
    queries.push({ bucket: 'holding', relatedTo: h.name, kind: 'yahoo', term: h.ticker })
  }

  for (const s of sectors.slice(0, MAX_SECTORS)) {
    queries.push({ bucket: 'sector', relatedTo: s, kind: 'google', term: `${s} sector` })
  }

  for (const topic of MACRO_TOPICS) {
    queries.push({ bucket: 'macro', relatedTo: 'Macro', kind: 'google', term: topic })
  }

  return queries
}

/** Keyless feed URL for a query. */
export function queryUrl(q: NewsQuery): string {
  if (q.kind === 'yahoo') {
    return `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(q.term)}&region=US&lang=en-US`
  }
  const term = encodeURIComponent(`${q.term} when:3d`)
  return `https://news.google.com/rss/search?q=${term}&hl=en-US&gl=US&ceid=US:en`
}
