import { describe, it, expect } from 'vitest'
import { parseRss } from '@/lib/news/rss'

const GOOGLE = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>News</title>
<item>
  <title>ECB raises interest rates - Reuters</title>
  <link>https://news.google.com/rss/articles/abc123</link>
  <pubDate>Wed, 11 Jun 2026 10:00:00 GMT</pubDate>
  <description>&lt;a href="x"&gt;The ECB raised rates&lt;/a&gt; in a telegraphed move.</description>
  <source url="https://reuters.com">Reuters</source>
</item>
<item>
  <title>Markets rally on tech earnings - CNBC</title>
  <link>https://news.google.com/rss/articles/def456</link>
  <pubDate>Tue, 10 Jun 2026 18:30:00 GMT</pubDate>
  <source url="https://cnbc.com">CNBC</source>
</item>
</channel></rss>`

const YAHOO = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>AAPL</title>
<item>
  <title>Apple stock jumps after WWDC</title>
  <link>https://finance.yahoo.com/news/apple-wwdc</link>
  <pubDate>Sun, 14 Jun 2026 13:05:00 +0000</pubDate>
  <description>Apple shares rose.</description>
</item>
</channel></rss>`

describe('parseRss', () => {
  it('parses Google News items and strips the " - Publisher" title suffix', () => {
    const items = parseRss(GOOGLE)
    expect(items).toHaveLength(2)
    const first = items[0]!
    expect(first.title).toBe('ECB raises interest rates') // suffix removed
    expect(first.source).toBe('Reuters')
    expect(first.url).toContain('news.google.com')
    expect(first.publishedAt).toBe('2026-06-11T10:00:00.000Z')
    expect(first.summary).toBe('The ECB raised rates in a telegraphed move.') // HTML stripped
  })

  it('derives source from the link host when no <source> element (Yahoo)', () => {
    const items = parseRss(YAHOO)
    expect(items).toHaveLength(1)
    expect(items[0]!.source).toBe('finance.yahoo.com')
    expect(items[0]!.title).toBe('Apple stock jumps after WWDC')
    expect(items[0]!.publishedAt).toBe('2026-06-14T13:05:00.000Z')
  })

  it('handles a single-item channel (item not an array)', () => {
    expect(parseRss(YAHOO)).toHaveLength(1)
  })

  it('returns [] for garbage and drops items missing title or link', () => {
    expect(parseRss('not xml at all')).toEqual([])
    expect(parseRss('<rss><channel><item><title>No link</title></item></channel></rss>')).toEqual([])
  })

  it('nulls an unparseable pubDate instead of throwing', () => {
    const xml = `<rss><channel><item><title>X - S</title><link>https://s.com/a</link><pubDate>nope</pubDate></item></channel></rss>`
    expect(parseRss(xml)[0]!.publishedAt).toBeNull()
  })
})
