import 'server-only'
import { parseStooqHistoryCsv } from './stooq'

/**
 * Monthly historical closes from Stooq. Requires STOOQ_API_KEY (the history
 * endpoint is key-gated, unlike the current-price endpoint). Returns null when
 * the key is missing or the fetch fails, so callers degrade gracefully.
 */
export async function fetchStooqHistory(
  symbol: string,
  fromYmd: string,
  toYmd: string,
): Promise<Array<{ date: string; close: number }> | null> {
  const key = process.env.STOOQ_API_KEY
  if (!key) return null

  const d1 = fromYmd.replace(/-/g, '')
  const d2 = toYmd.replace(/-/g, '')
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=m&d1=${d1}&d2=${d2}&apikey=${key}`

  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const text = await res.text()
    // The endpoint returns an instructional page (not CSV) when the key is bad.
    if (text.toLowerCase().includes('apikey')) return null
    return parseStooqHistoryCsv(text)
  } catch {
    return null
  }
}
