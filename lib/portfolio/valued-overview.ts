import 'server-only'
import type { AssetClass } from '@/lib/import/types'
import { getTransactionsForUser, type TransactionRow } from '@/lib/db/transactions'
import { reconstructPortfolio, totalReturn, valuePortfolio } from '@/lib/finance/holdings'
import { getEurPrices } from '@/lib/prices/quotes'
import { getInstrumentNames } from '@/lib/prices/names'
import { displayName } from '@/lib/prices/resolve'
import { buildAllocation, toLedger, type OverviewSlice } from './overview'

/**
 * Market-valued portfolio overview: ledger → holdings engine → live EUR prices.
 * Falls back gracefully — holdings whose price is unavailable are flagged, not
 * dropped, and the totals are taken over priced holdings + cash.
 */

export interface ValuedOverviewPosition {
  key: string
  label: string
  isin: string | null
  ticker: string | null
  assetClass: AssetClass | null
  quantity: number
  averageCost: number
  costBasis: number
  price: number | null
  marketValue: number | null
  unrealizedPnl: number | null
  priced: boolean
  currency: string
}

export interface ValuedOverview {
  hasData: boolean
  currency: string
  // Cost-basis figures
  investedAtCost: number
  cash: number
  netContributions: number
  income: number
  realizedPnl: number
  fees: number
  // Market figures (EUR)
  marketValue: number
  netWorth: number
  unrealizedPnl: number
  totalReturnAbs: number
  totalReturnPct: number
  unpricedCount: number
  asOf: string | null
  allocation: OverviewSlice[]
  positions: ValuedOverviewPosition[]
  transactions: TransactionRow[]
  /** ISIN → resolved instrument name, for the transaction ledger. */
  names: Record<string, string>
}

/** Scalar KPIs + allocation for the dashboard — the heavy ledger/names are dropped. */
export type DashboardSummary = Omit<ValuedOverview, 'transactions' | 'names' | 'positions'>

export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const o = await getValuedOverview(userId)
  return {
    hasData: o.hasData,
    currency: o.currency,
    investedAtCost: o.investedAtCost,
    cash: o.cash,
    netContributions: o.netContributions,
    income: o.income,
    realizedPnl: o.realizedPnl,
    fees: o.fees,
    marketValue: o.marketValue,
    netWorth: o.netWorth,
    unrealizedPnl: o.unrealizedPnl,
    totalReturnAbs: o.totalReturnAbs,
    totalReturnPct: o.totalReturnPct,
    unpricedCount: o.unpricedCount,
    asOf: o.asOf,
    allocation: o.allocation,
  }
}

export async function getValuedOverview(userId: string): Promise<ValuedOverview> {
  const transactions = await getTransactionsForUser(userId)
  const summary = reconstructPortfolio(toLedger(transactions))

  const { prices, unresolved, asOf } = await getEurPrices(
    summary.positions.map((p) => ({ isin: p.isin })),
  )
  const valued = valuePortfolio(summary, prices)
  const ret = totalReturn(valued, summary)

  // Names are populated by getEurPrices above (Stooq → isin_ticker_map), so read after.
  const names = await getInstrumentNames([
    ...summary.positions.map((p) => p.isin),
    ...transactions.map((t) => t.isin),
  ])

  const positions: ValuedOverviewPosition[] = valued.positions
    .map((p) => ({
      key: p.key,
      label: displayName(p.isin, p.ticker, names),
      isin: p.isin,
      ticker: p.ticker,
      assetClass: p.assetClass,
      quantity: p.quantity,
      averageCost: p.averageCost,
      costBasis: p.costBasis,
      price: p.price,
      marketValue: p.marketValue,
      unrealizedPnl: p.unrealizedPnl,
      priced: p.priced,
      currency: p.currency,
    }))
    .sort((a, b) => (b.marketValue ?? -1) - (a.marketValue ?? -1))

  return {
    hasData: transactions.length > 0,
    currency: summary.currency,
    investedAtCost: summary.positions.reduce((sum, p) => sum + p.costBasis, 0),
    cash: summary.cash,
    netContributions: summary.netContributions,
    income: summary.income,
    realizedPnl: summary.realizedPnl,
    fees: summary.fees,
    marketValue: valued.holdingsValue,
    netWorth: valued.netWorth,
    unrealizedPnl: positions.reduce((sum, p) => sum + (p.unrealizedPnl ?? 0), 0),
    totalReturnAbs: ret.absoluteReturn,
    totalReturnPct: ret.returnPct,
    unpricedCount: unresolved.length,
    asOf,
    allocation: buildAllocation(valued),
    positions,
    transactions,
    names,
  }
}
