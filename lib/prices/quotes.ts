import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { isinTickerMap, priceCache } from '@/lib/db/schema'
import { currencyForSymbol, resolveSymbol } from './resolve'
import { openFigiCandidates } from './openfigi'
import { fetchYahooQuote } from './yahoo'
import { fetchEcbEurRates, toEur } from './fx'

const PRICE_TTL_MS = 60 * 60 * 1000 // 1h — current price freshness

export interface EurPrices {
  /** EUR price keyed by ISIN. */
  prices: Record<string, number>
  /** ISINs that could not be resolved or priced. */
  unresolved: string[]
  /** Quote date of the prices used, if any. */
  asOf: string | null
}

type Db = ReturnType<typeof getDb>
interface Quote {
  close: number
  date: string
  currency: string
  name: string | null
}

/**
 * Cache-first price for a Yahoo symbol: read `price_cache` within TTL, else
 * fetch + upsert. Yahoo returns the quote currency, so it is stored and returned
 * rather than supplied by the caller.
 */
async function fetchQuoteCached(db: Db, symbol: string): Promise<Quote | null> {
  const [row] = await db
    .select()
    .from(priceCache)
    .where(eq(priceCache.ticker, symbol))
    .orderBy(desc(priceCache.date))
    .limit(1)

  if (row?.close != null && Date.now() - new Date(row.fetchedAt).getTime() < PRICE_TTL_MS) {
    return { close: Number(row.close), date: row.date, currency: row.currency ?? 'EUR', name: null }
  }

  const q = await fetchYahooQuote(symbol)
  if (!q) return null

  await db
    .insert(priceCache)
    .values({ ticker: symbol, date: q.date, close: String(q.close), currency: q.currency, source: 'yahoo' })
    .onConflictDoUpdate({
      target: [priceCache.ticker, priceCache.date],
      set: { close: String(q.close), currency: q.currency, source: 'yahoo', fetchedAt: new Date().toISOString() },
    })

  return { close: q.close, date: q.date, currency: q.currency, name: q.name }
}

export interface ResolvedSymbol {
  symbol: string
  currency: string
}

/**
 * Resolve an ISIN to a tradeable Yahoo symbol: curated map → cached DB mapping →
 * OpenFIGI (each candidate validated against Yahoo, the winner persisted to
 * isin_ticker_map). Shared by the current-price and historical-series paths so
 * both cover the same holdings.
 */
export async function resolveToSymbol(isin: string): Promise<ResolvedSymbol | null> {
  const curated = resolveSymbol(isin)
  if (curated) return { symbol: curated.yahoo, currency: curated.currency }

  const db = getDb()
  const [mapped] = await db
    .select()
    .from(isinTickerMap)
    .where(eq(isinTickerMap.isin, isin))
    .limit(1)
  if (mapped?.ticker) {
    return { symbol: mapped.ticker, currency: currencyForSymbol(mapped.ticker) ?? 'EUR' }
  }

  for (const candidate of await openFigiCandidates(isin)) {
    const quote = await fetchQuoteCached(getDb(), candidate.yahoo)
    if (!quote) continue
    const name = quote.name ?? candidate.name
    await getDb()
      .insert(isinTickerMap)
      .values({ isin, ticker: candidate.yahoo, name, source: 'openfigi' })
      .onConflictDoUpdate({
        target: isinTickerMap.isin,
        set: { ticker: candidate.yahoo, name, source: 'openfigi', resolvedAt: new Date().toISOString() },
      })
    return { symbol: candidate.yahoo, currency: candidate.currency }
  }

  return null
}

/**
 * EUR prices for a set of ISINs. Resolution and pricing fail soft — an ISIN that
 * can't be resolved or priced lands in `unresolved` instead of throwing.
 */
export async function getEurPrices(items: { isin: string | null }[]): Promise<EurPrices> {
  const db = getDb()
  const isins = [...new Set(items.map((i) => i.isin).filter((i): i is string => !!i))]
  if (isins.length === 0) return { prices: {}, unresolved: [], asOf: null }

  const rates = await fetchEcbEurRates()
  const prices: Record<string, number> = {}
  const unresolved: string[] = []
  let asOf: string | null = null

  for (const isin of isins) {
    const resolved = await resolveToSymbol(isin)
    if (!resolved) {
      unresolved.push(isin)
      continue
    }
    const quote = await fetchQuoteCached(db, resolved.symbol)
    if (!quote) {
      unresolved.push(isin)
      continue
    }
    const eur = toEur(quote.close, quote.currency, rates)
    if (eur == null) {
      unresolved.push(isin)
      continue
    }
    prices[isin] = eur
    asOf = asOf ?? quote.date
  }

  return { prices, unresolved, asOf }
}
