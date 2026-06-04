/**
 * Stooq price adapter (free, keyless). Yahoo Finance 429s from datacenter IPs,
 * so Stooq is the price source (see CLAUDE.md §7). One symbol per request — the
 * batch CSV endpoint returns N/D.
 */

export interface StooqQuote {
  symbol: string
  close: number
  date: string
}

/** Parse Stooq's single-row CSV: Symbol,Date,Time,Open,High,Low,Close,Volume. */
export function parseStooqCsv(text: string, symbol: string): StooqQuote | null {
  const lines = text.trim().split('\n')
  const dataRow = lines[1]
  if (!dataRow) return null
  const cols = dataRow.split(',')
  const date = cols[1]
  const close = cols[6]
  if (!date || date === 'N/D' || !close || close === 'N/D') return null
  const value = Number(close)
  if (!Number.isFinite(value)) return null
  return { symbol, close: value, date }
}

export async function fetchStooqQuote(symbol: string): Promise<StooqQuote | null> {
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcv&h&e=csv`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    return parseStooqCsv(await res.text(), symbol)
  } catch {
    return null
  }
}
