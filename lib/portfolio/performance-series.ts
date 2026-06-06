import 'server-only'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { priceCache } from '@/lib/db/schema'
import { getTransactionsForUser } from '@/lib/db/transactions'
import { resolveToSymbol } from '@/lib/prices/quotes'
import { fetchStooqHistory } from '@/lib/prices/history'
import { fetchEcbEurRates } from '@/lib/prices/fx'
import {
  monthlyDates,
  valueOverTime,
  type InstrumentSeries,
  type PerfPoint,
} from '@/lib/finance/performance'
import { toLedger } from './overview'

export interface PerformanceSeries {
  hasData: boolean
  /** Whether STOOQ_API_KEY is configured (history needs it). */
  hasKey: boolean
  currency: string
  points: PerfPoint[]
  /** ISINs with no resolvable price history (excluded from value). */
  missing: string[]
}

type Db = ReturnType<typeof getDb>

const HISTORY_SOURCE = 'stooq-hist'

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10)
}
function ymdDaysAgo(days: number): string {
  return ymd(new Date(Date.now() - days * 86_400_000))
}

/** Monthly closes for a symbol: cached history (refetched when stale) + the current price. */
async function getMonthlyHistory(
  db: Db,
  symbol: string,
  currency: string,
  fromYmd: string,
): Promise<Array<{ date: string; close: number }>> {
  const rows = await db.select().from(priceCache).where(eq(priceCache.ticker, symbol))

  let history = rows
    .filter((r) => r.source === HISTORY_SOURCE && r.close != null)
    .map((r) => ({ date: r.date, close: Number(r.close) }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const stale = history.length === 0 || history[history.length - 1]!.date < ymdDaysAgo(40)
  if (stale) {
    const fetched = await fetchStooqHistory(symbol, fromYmd, ymd(new Date()))
    if (fetched && fetched.length > 0) {
      await db
        .insert(priceCache)
        .values(
          fetched.map((p) => ({
            ticker: symbol,
            date: p.date,
            close: String(p.close),
            currency,
            source: HISTORY_SOURCE,
          })),
        )
        .onConflictDoNothing()
      const seen = new Set(history.map((h) => h.date))
      for (const p of fetched) if (!seen.has(p.date)) history.push(p)
      history = history.sort((a, b) => a.date.localeCompare(b.date))
    }
  }

  // Append the current daily price (from the quote endpoint) as the latest point.
  const current = rows
    .filter((r) => r.source !== HISTORY_SOURCE && r.close != null)
    .sort((a, b) => b.date.localeCompare(a.date))[0]
  if (current && (history.length === 0 || current.date > history[history.length - 1]!.date)) {
    history.push({ date: current.date, close: Number(current.close) })
  }

  return history
}

export async function getPerformanceSeries(userId: string): Promise<PerformanceSeries> {
  const hasKey = !!process.env.STOOQ_API_KEY
  const db = getDb()
  const transactions = await getTransactionsForUser(userId)

  if (transactions.length === 0) {
    return { hasData: false, hasKey, currency: 'EUR', points: [], missing: [] }
  }
  if (!hasKey) {
    return { hasData: true, hasKey: false, currency: 'EUR', points: [], missing: [] }
  }

  const ledger = toLedger(transactions)
  const first = transactions[0]!.date
  const heldIsins = [...new Set(ledger.map((t) => t.isin).filter((i): i is string => !!i))]

  const series: InstrumentSeries[] = []
  const missing: string[] = []
  for (const isin of heldIsins) {
    const resolved = await resolveToSymbol(isin)
    if (!resolved) {
      missing.push(isin)
      continue
    }
    const points = await getMonthlyHistory(db, resolved.symbol, resolved.currency, first)
    if (points.length === 0) {
      missing.push(isin)
      continue
    }
    series.push({ isin, currency: resolved.currency, points })
  }

  const rates = await fetchEcbEurRates()
  const points = valueOverTime(ledger, series, monthlyDates(first, ymd(new Date())), rates)

  return { hasData: true, hasKey: true, currency: 'EUR', points, missing }
}
