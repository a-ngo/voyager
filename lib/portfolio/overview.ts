import type { AssetClass, TransactionType } from '@/lib/import/types'
import type { TransactionRow } from '@/lib/db/transactions'
import {
  allocationByAssetClass,
  reconstructPortfolio,
  valueAtCost,
  type LedgerTransaction,
  type ValuedPortfolio,
} from '@/lib/finance/holdings'
import { BUCKET_COLOR, type Bucket } from './buckets'

/**
 * Portfolio overview at cost basis — the read model the Portfolio page renders.
 * Market value, unrealized gains, and total return arrive with the price layer;
 * everything here is derivable from the ledger alone.
 */

const num = (s: string | null): number | null => (s == null ? null : Number(s))

/** ISIN → instrument name from the broker export (latest non-empty wins). */
export function namesFromTransactions(rows: TransactionRow[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const r of rows) {
    if (r.isin && r.name && r.name.trim()) map[r.isin] = r.name.trim()
  }
  return map
}

/** DB rows → the holdings engine's input shape. */
export function toLedger(rows: TransactionRow[]): LedgerTransaction[] {
  return rows.map((r) => ({
    type: r.type as TransactionType,
    assetClass: r.assetClass as AssetClass | null,
    isin: r.isin,
    ticker: r.ticker,
    quantity: num(r.quantity),
    price: num(r.price),
    amount: num(r.amount),
    fee: num(r.fee),
    tax: num(r.tax),
    currency: r.currency,
    date: r.date,
  }))
}

export interface OverviewSlice {
  bucket: Bucket
  label: string
  value: number
  weight: number
  color: string
}

export interface OverviewPosition {
  key: string
  label: string
  isin: string | null
  ticker: string | null
  assetClass: AssetClass | null
  quantity: number
  averageCost: number
  costBasis: number
  currency: string
}

export interface PortfolioOverview {
  hasData: boolean
  currency: string
  investedAtCost: number
  cash: number
  netContributions: number
  income: number
  realizedPnl: number
  fees: number
  allocation: OverviewSlice[]
  positions: OverviewPosition[]
}

/**
 * Allocation slices for a valued portfolio: positive holdings + cash only,
 * renormalized so weights sum to 100. Works for cost-basis or market valuation.
 */
export function buildAllocation(valued: ValuedPortfolio): OverviewSlice[] {
  const positive = allocationByAssetClass(valued).filter((s) => s.value > 0.005)
  const total = positive.reduce((sum, s) => sum + s.value, 0)
  return positive.map((s) => ({
    bucket: s.bucket,
    label: s.label,
    value: s.value,
    weight: total > 0 ? (s.value / total) * 100 : 0,
    color: BUCKET_COLOR[s.bucket] ?? BUCKET_COLOR.other,
  }))
}

export function buildOverview(ledger: LedgerTransaction[]): PortfolioOverview {
  const summary = reconstructPortfolio(ledger)
  const allocation = buildAllocation(valueAtCost(summary))

  const positions: OverviewPosition[] = [...summary.positions]
    .sort((a, b) => b.costBasis - a.costBasis)
    .map((p) => ({
      key: p.key,
      label: p.ticker ?? p.isin ?? p.key,
      isin: p.isin,
      ticker: p.ticker,
      assetClass: p.assetClass,
      quantity: p.quantity,
      averageCost: p.averageCost,
      costBasis: p.costBasis,
      currency: p.currency,
    }))

  return {
    hasData: ledger.length > 0,
    currency: summary.currency,
    investedAtCost: summary.positions.reduce((sum, p) => sum + p.costBasis, 0),
    cash: summary.cash,
    netContributions: summary.netContributions,
    income: summary.income,
    realizedPnl: summary.realizedPnl,
    fees: summary.fees,
    allocation,
    positions,
  }
}
