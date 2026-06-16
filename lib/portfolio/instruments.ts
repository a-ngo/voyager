import 'server-only'
import type { AssetClass } from '@/lib/import/types'
import { getDb } from '@/lib/db'
import { getTransactionsForUser } from '@/lib/db/transactions'
import { instrumentLedgerStats, reconstructPortfolio, valuePortfolio } from '@/lib/finance/holdings'
import { instrumentValueOverTime, monthlyDates } from '@/lib/finance/performance'
import { getEurPrices } from '@/lib/prices/quotes'
import { fetchEcbEurRates } from '@/lib/prices/fx'
import { getInstrumentNames } from '@/lib/prices/names'
import { displayName } from '@/lib/prices/resolve'
import { namesFromTransactions, toLedger } from './overview'
import { buildInstrumentSeries } from './performance-series'

/**
 * Every instrument ever traded (open and closed), with the figures the Clusters
 * page groups by: live EUR market value + unrealized P/L for open positions,
 * realized P/L and income across all trades, and gross capital invested.
 */
export interface InstrumentBreakdownItem {
  key: string
  isin: string | null
  ticker: string | null
  name: string
  assetClass: AssetClass | null
  quantity: number
  costBasis: number
  marketValue: number | null
  unrealizedPnl: number | null
  realizedPnl: number
  income: number
  invested: number
  open: boolean
  priced: boolean
  /** EUR market value at each date in {@link InstrumentBreakdown.dates}. */
  valueSeries: number[]
}

export interface InstrumentBreakdown {
  hasData: boolean
  currency: string
  /** Monthly sample dates (YYYY-MM-DD) for the value series. */
  dates: string[]
  instruments: InstrumentBreakdownItem[]
}

export async function getInstrumentBreakdown(userId: string): Promise<InstrumentBreakdown> {
  const db = getDb()
  const transactions = await getTransactionsForUser(userId)
  if (transactions.length === 0)
    return { hasData: false, currency: 'EUR', dates: [], instruments: [] }

  const ledger = toLedger(transactions)
  const summary = reconstructPortfolio(ledger)
  const stats = instrumentLedgerStats(ledger)

  // Live EUR prices for open positions; closed positions need none.
  const { prices } = await getEurPrices(summary.positions.map((p) => ({ isin: p.isin })))
  const valued = valuePortfolio(summary, prices)
  const valuedByKey = new Map(valued.positions.map((p) => [p.key, p]))

  // Per-instrument monthly value series, for the per-cluster value chart.
  const first = transactions[0]!.date
  const dates = monthlyDates(first, new Date().toISOString().slice(0, 10))
  const { series } = await buildInstrumentSeries(db, ledger, first)
  const rates = await fetchEcbEurRates()
  const seriesByKey = new Map(
    instrumentValueOverTime(ledger, series, dates, rates).map((v) => [v.key, v.values]),
  )

  const names = {
    ...(await getInstrumentNames(stats.map((s) => s.isin))),
    ...namesFromTransactions(transactions),
  }

  const instruments: InstrumentBreakdownItem[] = stats
    .map((s) => {
      const v = valuedByKey.get(s.key)
      const open = s.quantity !== 0
      return {
        key: s.key,
        isin: s.isin,
        ticker: s.ticker,
        name: displayName(s.isin, s.ticker, names),
        assetClass: s.assetClass,
        quantity: s.quantity,
        costBasis: s.costBasis,
        marketValue: open ? (v?.marketValue ?? null) : 0,
        unrealizedPnl: open ? (v?.unrealizedPnl ?? null) : 0,
        realizedPnl: s.realizedPnl,
        income: s.income,
        invested: s.invested,
        open,
        priced: open ? (v?.priced ?? false) : true,
        valueSeries: seriesByKey.get(s.key) ?? new Array(dates.length).fill(0),
      }
    })
    .sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0) || b.invested - a.invested)

  return { hasData: true, currency: summary.currency, dates, instruments }
}
