import type { AssetClass, TransactionType } from '@/lib/import/types'

/**
 * Portfolio reconstruction from the transaction ledger. Pure functions: plain
 * data in, typed results out. No DB, no fetch, no formatting.
 *
 * Pipeline:
 *   reconstructPortfolio(txns)        → positions + cash + cashflow summary
 *   valuePortfolio(summary, prices)   → market values (prices injected, stays pure)
 *   allocationByAssetClass(valued)    → allocation slices with weights
 *   totalReturn(valued, summary)      → simple money-weighted return
 *
 * Conventions:
 * - Quantities and types drive the math; the stored sign of `amount` is ignored
 *   (broker sign conventions vary). Magnitudes are taken with Math.abs.
 * - Cost basis uses the average-cost method and capitalizes buy fees. Sell fees
 *   and taxes reduce proceeds. (FIFO, needed for German tax lots, is a later layer.)
 * - Single-currency: amounts are treated as already in the account currency.
 *   FX normalization is a separate layer on top.
 */

const EPSILON = 1e-9

/**
 * Types that actually transact shares. Some brokers (Trade Republic) populate
 * the `shares` column on dividend rows with the position size the dividend was
 * paid on — those must not be mistaken for a free-share acquisition.
 */
const SHARE_MOVING_TYPES = new Set<TransactionType>(['buy', 'sell', 'reward'])

/** Minimal transaction shape the engine needs. MappedTransaction is assignable to this. */
export interface LedgerTransaction {
  type: TransactionType
  assetClass: AssetClass | null
  isin: string | null
  ticker: string | null
  quantity: number | null
  price: number | null
  amount: number | null
  fee: number | null
  tax: number | null
  currency: string
  date: string
}

export interface Position {
  /** Stable identity: isin, else ticker, else 'UNKNOWN'. */
  key: string
  isin: string | null
  ticker: string | null
  assetClass: AssetClass | null
  quantity: number
  /** Cost of the currently held shares, fees capitalized. */
  costBasis: number
  /** costBasis / quantity, or 0 when flat. */
  averageCost: number
  /** Realized profit/loss from sells of this position. */
  realizedPnl: number
  currency: string
}

export interface PortfolioSummary {
  /** Open positions only (quantity > 0). */
  positions: Position[]
  cash: number
  /** deposits − withdrawals. */
  netContributions: number
  /** dividends + interest + tax refunds + cash rewards. */
  income: number
  /** All fees paid (transaction + standalone). */
  fees: number
  /** Realized P/L across all positions, including fully closed ones. */
  realizedPnl: number
  currency: string
}

interface MutablePosition {
  isin: string | null
  ticker: string | null
  assetClass: AssetClass | null
  quantity: number
  costBasis: number
  realizedPnl: number
  currency: string
}

function positionKey(tx: LedgerTransaction): string {
  return tx.isin ?? tx.ticker ?? 'UNKNOWN'
}

function getPosition(map: Map<string, MutablePosition>, tx: LedgerTransaction): MutablePosition {
  const key = positionKey(tx)
  let pos = map.get(key)
  if (!pos) {
    pos = {
      isin: tx.isin,
      ticker: tx.ticker,
      assetClass: tx.assetClass,
      quantity: 0,
      costBasis: 0,
      realizedPnl: 0,
      currency: tx.currency,
    }
    map.set(key, pos)
  }
  // Backfill identity fields that may have been null on an earlier row.
  pos.assetClass ??= tx.assetClass
  pos.ticker ??= tx.ticker
  pos.isin ??= tx.isin
  return pos
}

export function reconstructPortfolio(transactions: LedgerTransaction[]): PortfolioSummary {
  const map = new Map<string, MutablePosition>()
  let cash = 0
  let netContributions = 0
  let income = 0
  let fees = 0
  let realizedPnl = 0
  let currency = 'EUR'
  let currencySet = false

  for (const tx of transactions) {
    if (!currencySet && tx.currency) {
      currency = tx.currency
      currencySet = true
    }

    // Use the broker's signs directly: inflows positive, outflows negative, fees
    // and withholding tax negative. Cash always moves by the net amount the
    // broker booked. Shares are signed too (negative on sells).
    const amount = tx.amount ?? 0
    const fee = tx.fee ?? 0
    const tax = tx.tax ?? 0
    const shares = tx.quantity ?? 0

    cash += amount + fee + tax
    if (fee < 0) fees += -fee

    // Share movements: positions + cost basis (average cost, fees capitalized).
    // Only for types that transact shares — a dividend's `shares` is the position
    // it was paid on, not an acquisition (see SHARE_MOVING_TYPES).
    if (SHARE_MOVING_TYPES.has(tx.type) && Math.abs(shares) > EPSILON) {
      const pos = getPosition(map, tx)
      if (shares > 0) {
        // Acquisition — cost is the cash paid: -(amount + fee). Free shares → 0.
        pos.quantity += shares
        pos.costBasis += Math.max(0, -(amount + fee))
      } else {
        // Disposal — proceeds are the net cash received; realize gain vs avg cost.
        const soldQty = -shares
        const avgCost = pos.quantity > EPSILON ? pos.costBasis / pos.quantity : 0
        const proceeds = amount + fee + tax
        const costOfSold = avgCost * soldQty
        pos.quantity += shares // shares < 0 → reduces the holding
        pos.costBasis -= costOfSold
        pos.realizedPnl += proceeds - costOfSold
        realizedPnl += proceeds - costOfSold
      }
    }

    // Reporting tallies (cash is already handled above).
    switch (tx.type) {
      case 'deposit':
      case 'withdrawal':
        netContributions += amount // deposit +, withdrawal − (already signed)
        break
      case 'dividend':
      case 'interest':
      case 'tax_refund':
        income += amount + tax
        break
      case 'reward':
        if (Math.abs(shares) <= EPSILON) income += amount // cash bonus (free shares add no income)
        break
      default:
        break
    }
  }

  const positions: Position[] = []
  for (const [key, pos] of map) {
    if (Math.abs(pos.quantity) < EPSILON) continue // flat — closed position
    const costBasis = Math.abs(pos.costBasis) < EPSILON ? 0 : pos.costBasis
    positions.push({
      key,
      isin: pos.isin,
      ticker: pos.ticker,
      assetClass: pos.assetClass,
      quantity: pos.quantity,
      costBasis,
      averageCost: pos.quantity > EPSILON ? costBasis / pos.quantity : 0,
      realizedPnl: pos.realizedPnl,
      currency: pos.currency,
    })
  }

  return { positions, cash, netContributions, income, fees, realizedPnl, currency }
}

export interface ValuedPosition extends Position {
  price: number | null
  marketValue: number | null
  unrealizedPnl: number | null
  priced: boolean
}

export interface ValuedPortfolio {
  positions: ValuedPosition[]
  /** Sum of priced positions' market value. */
  holdingsValue: number
  cash: number
  /** holdingsValue + cash. */
  netWorth: number
  /** Positions with no price available (excluded from holdingsValue). */
  unpricedCount: number
  currency: string
}

/**
 * Values positions against a price map keyed by ISIN or ticker. Prices are
 * passed in (not fetched) to keep this pure and trivially testable. Positions
 * with no price are flagged and excluded from totals rather than valued at zero.
 */
export function valuePortfolio(
  summary: PortfolioSummary,
  prices: Record<string, number>,
): ValuedPortfolio {
  const positions: ValuedPosition[] = summary.positions.map((p) => {
    const price =
      (p.isin != null ? prices[p.isin] : undefined) ??
      (p.ticker != null ? prices[p.ticker] : undefined) ??
      null
    const priced = price != null
    const marketValue = priced ? p.quantity * price : null
    const unrealizedPnl = marketValue != null ? marketValue - p.costBasis : null
    return { ...p, price, priced, marketValue, unrealizedPnl }
  })

  const holdingsValue = positions.reduce((sum, p) => sum + (p.marketValue ?? 0), 0)
  const unpricedCount = positions.filter((p) => !p.priced).length

  return {
    positions,
    holdingsValue,
    cash: summary.cash,
    netWorth: holdingsValue + summary.cash,
    unpricedCount,
    currency: summary.currency,
  }
}

/**
 * Values every position at its own cost basis (price = average cost). Lets the
 * allocation/return helpers run before a live price source exists — the result
 * reflects what was paid, not current market value.
 */
export function valueAtCost(summary: PortfolioSummary): ValuedPortfolio {
  const positions: ValuedPosition[] = summary.positions.map((p) => ({
    ...p,
    price: p.averageCost,
    priced: true,
    marketValue: p.costBasis,
    unrealizedPnl: 0,
  }))
  const holdingsValue = positions.reduce((sum, p) => sum + p.costBasis, 0)
  return {
    positions,
    holdingsValue,
    cash: summary.cash,
    netWorth: holdingsValue + summary.cash,
    unpricedCount: 0,
    currency: summary.currency,
  }
}

export interface AllocationSlice {
  bucket: AssetClass | 'cash' | 'other'
  label: string
  value: number
  /** Percent of net worth. */
  weight: number
}

const BUCKET_LABELS: Record<AssetClass | 'cash' | 'other', string> = {
  stock: 'Stocks',
  etf: 'ETFs',
  bond: 'Bonds',
  crypto: 'Crypto',
  cash: 'Cash',
  other: 'Other',
}

/**
 * Aggregates priced positions by asset class, plus a cash bucket, with weights
 * as a percent of net worth. Unpriced positions are omitted (their value is
 * unknown), so weights are taken over priced holdings + cash.
 */
export function allocationByAssetClass(valued: ValuedPortfolio): AllocationSlice[] {
  const byBucket = new Map<AssetClass | 'cash' | 'other', number>()

  for (const p of valued.positions) {
    if (p.marketValue == null) continue
    const bucket: AssetClass | 'other' = p.assetClass ?? 'other'
    byBucket.set(bucket, (byBucket.get(bucket) ?? 0) + p.marketValue)
  }
  if (Math.abs(valued.cash) > EPSILON) {
    byBucket.set('cash', (byBucket.get('cash') ?? 0) + valued.cash)
  }

  const total = valued.netWorth
  const slices: AllocationSlice[] = []
  for (const [bucket, value] of byBucket) {
    slices.push({
      bucket,
      label: BUCKET_LABELS[bucket],
      value,
      weight: Math.abs(total) > EPSILON ? (value / total) * 100 : 0,
    })
  }

  return slices.sort((a, b) => b.value - a.value)
}

export interface ReturnSummary {
  /** Net cash put in: deposits − withdrawals. */
  netContributions: number
  /** Current net worth (holdings + cash). */
  currentValue: number
  /** currentValue − netContributions. */
  absoluteReturn: number
  /** Return as a percent of net contributions (0 when none). */
  returnPct: number
}

/**
 * Simple money-weighted return: how much more the portfolio is worth than the
 * net cash contributed. Time-weighted return (TWR), which needs a dated value
 * series, is a separate Phase 2 function.
 */
export function totalReturn(valued: ValuedPortfolio, summary: PortfolioSummary): ReturnSummary {
  const netContributions = summary.netContributions
  const currentValue = valued.netWorth
  const absoluteReturn = currentValue - netContributions
  return {
    netContributions,
    currentValue,
    absoluteReturn,
    returnPct: netContributions > EPSILON ? (absoluteReturn / netContributions) * 100 : 0,
  }
}
