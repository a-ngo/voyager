import 'server-only'
import { inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { isinTickerMap, priceCache } from '@/lib/db/schema'
import { resolveSymbol } from './resolve'
import { fetchStooqQuote } from './stooq'
import { fetchEcbEurRates, toEur } from './fx'

const PRICE_TTL_MS = 60 * 60 * 1000 // 1h — current price freshness (CLAUDE.md §7)

export interface EurPrices {
  /** EUR price keyed by ISIN. */
  prices: Record<string, number>
  /** ISINs that could not be resolved or priced. */
  unresolved: string[]
  /** Quote date of the prices used, if any. */
  asOf: string | null
}

/**
 * Resolves ISINs to symbols, fetches their prices (cache-first, then Stooq),
 * converts to EUR via ECB rates, and returns a price-per-ISIN map. Network or
 * resolution failures fall through to `unresolved` rather than throwing — the
 * caller renders those holdings as unpriced.
 */
export async function getEurPrices(items: { isin: string | null }[]): Promise<EurPrices> {
  const db = getDb()
  const unresolved: string[] = []
  const resolved = new Map<string, { symbol: string; currency: string }>()

  for (const { isin } of items) {
    if (!isin) continue
    const r = resolveSymbol(isin)
    if (r) resolved.set(isin, { symbol: r.stooq, currency: r.currency })
    else unresolved.push(isin)
  }
  if (resolved.size === 0) return { prices: {}, unresolved, asOf: null }

  const symbols = [...new Set([...resolved.values()].map((r) => r.symbol))]
  const symbolCurrency = new Map([...resolved.values()].map((r) => [r.symbol, r.currency]))

  // Cache-first read.
  const now = Date.now()
  const quotes = new Map<string, { close: number; date: string }>()
  const cached = await db.select().from(priceCache).where(inArray(priceCache.ticker, symbols))
  for (const row of cached) {
    if (row.close != null && now - new Date(row.fetchedAt).getTime() < PRICE_TTL_MS) {
      quotes.set(row.ticker, { close: Number(row.close), date: row.date })
    }
  }

  // Fetch any misses from Stooq and upsert into the cache. Also persist the
  // instrument name into isin_ticker_map so the UI can show it later.
  for (const [isin, { symbol }] of resolved) {
    if (quotes.has(symbol)) continue
    const q = await fetchStooqQuote(symbol)
    if (!q) continue
    quotes.set(symbol, { close: q.close, date: q.date })
    await db
      .insert(priceCache)
      .values({
        ticker: symbol,
        date: q.date,
        close: String(q.close),
        currency: symbolCurrency.get(symbol) ?? 'EUR',
        source: 'stooq',
      })
      .onConflictDoUpdate({
        target: [priceCache.ticker, priceCache.date],
        set: { close: String(q.close), source: 'stooq', fetchedAt: new Date().toISOString() },
      })
    if (q.name) {
      await db
        .insert(isinTickerMap)
        .values({ isin, ticker: symbol, name: q.name, source: 'stooq' })
        .onConflictDoUpdate({
          target: isinTickerMap.isin,
          set: { ticker: symbol, name: q.name, source: 'stooq', resolvedAt: new Date().toISOString() },
        })
    }
  }

  const rates = await fetchEcbEurRates()
  const prices: Record<string, number> = {}
  let asOf: string | null = null

  for (const [isin, { symbol, currency }] of resolved) {
    const q = quotes.get(symbol)
    if (!q) {
      unresolved.push(isin)
      continue
    }
    const eur = toEur(q.close, currency, rates)
    if (eur == null) {
      unresolved.push(isin)
      continue
    }
    prices[isin] = eur
    asOf = asOf ?? q.date
  }

  return { prices, unresolved, asOf }
}
