import { XMLParser } from 'fast-xml-parser'
import type { NewsItem } from './types'

/**
 * Minimal RSS 2.0 → NewsItem parser. Pure (no fetch), so it's unit-testable.
 * Handles the two keyless shapes we use: Google News (title suffixed with
 * " - Publisher", a <source> element, redirect <link>) and Yahoo (direct
 * <link>, no <source>).
 */

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })

/** Extract text from a node that may be a string, number, or `{ '#text': ... }`. */
function text(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (typeof v === 'object' && '#text' in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>)['#text'] ?? '')
  }
  return ''
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function toIso(pubDate: string): string | null {
  const t = Date.parse(pubDate)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

export function parseRss(xml: string): NewsItem[] {
  let doc: { rss?: { channel?: { item?: unknown } } }
  try {
    doc = parser.parse(xml)
  } catch {
    return []
  }
  const raw = doc.rss?.channel?.item
  const items = Array.isArray(raw) ? raw : raw ? [raw] : []

  const out: NewsItem[] = []
  for (const entry of items) {
    if (typeof entry !== 'object' || entry === null) continue
    const it = entry as Record<string, unknown>
    const url = text(it.link).trim()
    let title = text(it.title).trim()
    if (!title || !url) continue

    const source = text(it.source).trim() || hostname(url) || 'News'
    // Google News appends " - Publisher" to titles; strip when it matches source.
    if (source && title.endsWith(` - ${source}`)) {
      title = title.slice(0, title.length - source.length - 3).trim()
    }

    const summary = stripHtml(text(it.description))
    out.push({
      title,
      url,
      source,
      publishedAt: toIso(text(it.pubDate)),
      summary: summary ? (summary.length > 200 ? `${summary.slice(0, 197)}…` : summary) : null,
    })
  }
  return out
}
