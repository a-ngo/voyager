import 'server-only'
import { getDb } from '@/lib/db'
import { getTransactionsForUser } from '@/lib/db/transactions'
import {
  getBenchmark,
  replayBenchmark,
  type BenchmarkPoint,
  type ContributionEvent,
  type ResolvedComponent,
} from '@/lib/finance/benchmark'
import { monthlyDates } from '@/lib/finance/performance'
import { getMonthlyHistory } from './performance-series'
import { toLedger } from './overview'

export interface BenchmarkSeries {
  id: string
  label: string
  points: BenchmarkPoint[]
}

/**
 * Alternative-reality series for one benchmark: the same deposits/withdrawals
 * replayed into the benchmark basket, valued over the portfolio's monthly axis.
 * Returns null for an unknown id; empty points when there are no transactions.
 */
export async function getBenchmarkSeries(
  userId: string,
  benchmarkId: string,
): Promise<BenchmarkSeries | null> {
  const def = getBenchmark(benchmarkId)
  if (!def) return null

  const db = getDb()
  const transactions = await getTransactionsForUser(userId)
  if (transactions.length === 0) return { id: def.id, label: def.label, points: [] }

  const ledger = toLedger(transactions)
  const first = transactions[0]!.date
  const today = new Date().toISOString().slice(0, 10)
  const dates = monthlyDates(first, today)

  // External cashflows only — deposits (+) and withdrawals (−), ascending.
  const contributions: ContributionEvent[] = ledger
    .filter((t) => t.type === 'deposit' || t.type === 'withdrawal')
    .map((t) => ({ date: t.date, amount: t.amount ?? 0 }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const components: ResolvedComponent[] = []
  for (const c of def.components) {
    const points = await getMonthlyHistory(db, c.symbol, 'EUR', first)
    components.push({ weight: c.weight, points })
  }

  return { id: def.id, label: def.label, points: replayBenchmark(contributions, components, dates) }
}
