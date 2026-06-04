import 'server-only'
import type { AssetClass } from '@/lib/import/types'
import { getTransactionsForUser, type TransactionRow } from '@/lib/db/transactions'
import { reconstructPortfolio, totalReturn, valuePortfolio } from '@/lib/finance/holdings'
import { getEurPrices } from '@/lib/prices/quotes'
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
}

export async function getValuedOverview(userId: string): Promise<ValuedOverview> {
  const transactions = await getTransactionsForUser(userId)
  const summary = reconstructPortfolio(toLedger(transactions))

  const { prices, unresolved, asOf } = await getEurPrices(
    summary.positions.map((p) => ({ isin: p.isin })),
  )
  const valued = valuePortfolio(summary, prices)
  const ret = totalReturn(valued, summary)

  const positions: ValuedOverviewPosition[] = valued.positions
    .map((p) => ({
      key: p.key,
      label: displayName(p.isin, p.ticker),
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
  }
}
