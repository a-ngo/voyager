/**
 * Yahoo Finance price adapter (unofficial, keyless). The v8 chart endpoint
 * serves both the current quote and historical closes, returns the quote
 * currency in its metadata, and covers the European listings (XETRA, Euronext)
 * that keyless and free-tier alternatives gate behind paid plans. Needs a
 * browser User-Agent; the chart endpoint requires no cookie/crumb handshake.
 * Adapter is swappable if a better source appears.
 */

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
const CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart'

export interface YahooQuote {
  symbol: string
  close: number
  date: string
  currency: string
  name: string | null
}

interface ChartResult {
  meta?: {
    currency?: string
    regularMarketPrice?: number
    regularMarketTime?: number
    longName?: string
    shortName?: string
  }
  timestamp?: number[]
  indicators?: { quote?: Array<{ close?: (number | null)[] }> }
}
interface ChartResponse {
  chart?: { result?: ChartResult[] | null }
}

function tsToYmd(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10)
}

/** Latest quote from a v8 chart payload. Yahoo carries the quote currency in meta. */
export function parseYahooQuote(json: unknown, symbol: string): YahooQuote | null {
  const meta = (json as ChartResponse)?.chart?.result?.[0]?.meta
  const price = meta?.regularMarketPrice
  const currency = meta?.currency
  if (price == null || !Number.isFinite(price) || !currency) return null
  const date = meta.regularMarketTime
    ? tsToYmd(meta.regularMarketTime)
    : new Date().toISOString().slice(0, 10)
  return { symbol, close: price, date, currency, name: meta.longName ?? meta.shortName ?? null }
}

/** Ascending {date, close} points from a v8 chart payload; null closes are dropped. */
export function parseYahooHistory(json: unknown): Array<{ date: string; close: number }> {
  const result = (json as ChartResponse)?.chart?.result?.[0]
  const ts = result?.timestamp
  const closes = result?.indicators?.quote?.[0]?.close
  if (!ts || !closes) return []
  const out: Array<{ date: string; close: number }> = []
  for (let i = 0; i < ts.length; i++) {
    const close = closes[i]
    const t = ts[i]
    if (close == null || !Number.isFinite(close) || t == null) continue
    out.push({ date: tsToYmd(t), close })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

export async function fetchYahooQuote(symbol: string): Promise<YahooQuote | null> {
  const url = `${CHART_BASE}/${encodeURIComponent(symbol)}?interval=1d&range=1d`
  try {
    const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': UA } })
    if (!res.ok) return null
    return parseYahooQuote(await res.json(), symbol)
  } catch {
    return null
  }
}

/** Monthly historical closes between two YYYY-MM-DD dates. Null on fetch failure. */
export async function fetchYahooHistory(
  symbol: string,
  fromYmd: string,
  toYmd: string,
): Promise<Array<{ date: string; close: number }> | null> {
  const p1 = Math.floor(new Date(`${fromYmd}T00:00:00Z`).getTime() / 1000)
  const p2 = Math.floor(new Date(`${toYmd}T23:59:59Z`).getTime() / 1000)
  const url = `${CHART_BASE}/${encodeURIComponent(symbol)}?interval=1mo&period1=${p1}&period2=${p2}`
  try {
    const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': UA } })
    if (!res.ok) return null
    return parseYahooHistory(await res.json())
  } catch {
    return null
  }
}
