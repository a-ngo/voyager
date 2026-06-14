import 'server-only'
import { parseRss } from './rss'
import type { NewsItem } from './types'

/**
 * General (non-personalized) financial news from keyless RSS feeds. Merged,
 * deduped, recency-sorted, cached ~30 min (free feeds rate-limit, and the news
 * doesn't change minute-to-minute). The "For You" personalized feed will layer
 * portfolio-derived queries + relevance ranking on top later.
 *
 * Note: like the Yahoo price layer (§7), these feeds can throttle datacenter
 * IPs, so this is local-first; production would want a keyed source or proxy.
 */

const GENERAL_FEEDS: string[] = [
  'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=stock+market+OR+economy+when:2d&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=ECB+OR+Federal+Reserve+interest+rates+when:3d&hl=en-US&gl=US&ceid=US:en',
]

const UA = 'Mozilla/5.0 (compatible; VoyagerNews/1.0)'
const TTL_MS = 30 * 60_000
const MAX_ITEMS = 40

let cache: { at: number; items: NewsItem[] } | null = null

async function fetchFeed(url: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []
    return parseRss(await res.text())
  } catch {
    return []
  }
}

/** Dedupe by normalized title (the same story appears across feeds). */
function dedupe(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>()
  const out: NewsItem[] = []
  for (const it of items) {
    const key = it.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    if (key && !seen.has(key)) {
      seen.add(key)
      out.push(it)
    }
  }
  return out
}

export async function getGeneralNews(): Promise<NewsItem[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.items

  const results = await Promise.all(GENERAL_FEEDS.map(fetchFeed))
  const items = dedupe(results.flat())
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    .slice(0, MAX_ITEMS)

  cache = { at: Date.now(), items }
  return items
}
