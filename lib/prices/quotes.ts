import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { isinTickerMap, priceCache } from '@/lib/db/schema'
import { currencyForSymbol, resolveSymbol } from './resolve'
import { openFigiCandidates } from './openfigi'
import { fetchStooqQuote } from './stooq'
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
  name: string | null
}

/** Cache-first price for a Stooq symbol: read `price_cache` within TTL, else fetch + upsert. */
async function fetchQuoteCached(db: Db, symbol: string, currency: string): Promise<Quote | null> {
  const [row] = await db
    .select()
    .from(priceCache)
    .where(eq(priceCache.ticker, symbol))
    .orderBy(desc(priceCache.date))
    .limit(1)

  if (row?.close != null && Date.now() - new Date(row.fetchedAt).getTime() < PRICE_TTL_MS) {
    return { close: Number(row.close), date: row.date, name: null }
  }

  const q = await fetchStooqQuote(symbol)
  if (!q) return null

  await db
    .insert(priceCache)
    .values({ ticker: symbol, date: q.date, close: String(q.close), currency, source: 'stooq' })
    .onConflictDoUpdate({
      target: [priceCache.ticker, priceCache.date],
      set: { close: String(q.close), currency, source: 'stooq', fetchedAt: new Date().toISOString() },
    })

  return { close: q.close, date: q.date, name: q.name }
}

interface Resolution {
  symbol: string
  currency: string
  quote: Quote
}

/** Resolve an ISIN to a priced symbol: curated map → cached mapping → OpenFIGI. */
async function resolve(db: Db, isin: string): Promise<Resolution | null> {
  // 1. Curated map (highest quality).
  const curated = resolveSymbol(isin)
  if (curated) {
    const quote = await fetchQuoteCached(db, curated.stooq, curated.currency)
    return quote ? { symbol: curated.stooq, currency: curated.currency, quote } : null
  }

  // 2. Previously resolved mapping in the DB.
  const [mapped] = await db
    .select()
    .from(isinTickerMap)
    .where(eq(isinTickerMap.isin, isin))
    .limit(1)
  if (mapped?.ticker) {
    const currency = currencyForSymbol(mapped.ticker) ?? 'EUR'
    const quote = await fetchQuoteCached(db, mapped.ticker, currency)
    if (quote) return { symbol: mapped.ticker, currency, quote }
  }

  // 3. OpenFIGI — try candidates until one prices, then persist the winner.
  for (const candidate of await openFigiCandidates(isin)) {
    const quote = await fetchQuoteCached(db, candidate.stooq, candidate.currency)
    if (!quote) continue
    const name = quote.name ?? candidate.name
    await db
      .insert(isinTickerMap)
      .values({ isin, ticker: candidate.stooq, name, source: 'openfigi' })
      .onConflictDoUpdate({
        target: isinTickerMap.isin,
        set: { ticker: candidate.stooq, name, source: 'openfigi', resolvedAt: new Date().toISOString() },
      })
    return { symbol: candidate.stooq, currency: candidate.currency, quote }
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
    const r = await resolve(db, isin)
    if (!r) {
      unresolved.push(isin)
      continue
    }
    const eur = toEur(r.quote.close, r.currency, rates)
    if (eur == null) {
      unresolved.push(isin)
      continue
    }
    prices[isin] = eur
    asOf = asOf ?? r.quote.date
  }

  return { prices, unresolved, asOf }
}
