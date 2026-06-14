import type { RankedNewsItem, Relevance } from './types'

/** Order buckets holdings → sectors → macro, then by recency. The recency fallback. */
const BUCKET_RANK: Record<RankedNewsItem['bucket'], number> = { holding: 0, sector: 1, macro: 2 }

export function rankByRecency(items: RankedNewsItem[]): RankedNewsItem[] {
  return [...items].sort(
    (a, b) =>
      BUCKET_RANK[a.bucket] - BUCKET_RANK[b.bucket] ||
      (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
  )
}

export interface RankSignal {
  index: number
  relevance: Relevance
  why: string
}

/**
 * Defensively parse the model's ranking output. Models (especially local ones)
 * wrap JSON in prose, so we extract the first array and validate loosely.
 * Returns the signals it could read; the caller maps them back to candidates.
 */
export function parseRanking(text: string): RankSignal[] {
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(match[0])
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const out: RankSignal[] = []
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue
    const o = entry as Record<string, unknown>
    const rawIndex = typeof o.index === 'number' ? o.index : typeof o.i === 'number' ? o.i : null
    if (rawIndex === null || !Number.isInteger(rawIndex)) continue
    const rel = o.relevance
    const relevance: Relevance = rel === 'high' || rel === 'low' ? rel : 'medium'
    out.push({ index: rawIndex, relevance, why: typeof o.why === 'string' ? o.why.trim() : '' })
  }
  return out
}

/** Sort selected items by relevance, then bucket, then recency. */
const RELEVANCE_RANK: Record<Relevance, number> = { high: 0, medium: 1, low: 2 }

export function sortRanked(items: RankedNewsItem[]): RankedNewsItem[] {
  return [...items].sort(
    (a, b) =>
      RELEVANCE_RANK[a.relevance] - RELEVANCE_RANK[b.relevance] ||
      BUCKET_RANK[a.bucket] - BUCKET_RANK[b.bucket] ||
      (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
  )
}
