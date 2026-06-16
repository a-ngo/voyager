/**
 * Contribution decomposition: split a portfolio's value into the capital the
 * investor put in versus the gain the market added, both in total (since
 * inception) and per calendar year. Pure function over the same dated value
 * series as the return metrics.
 *
 * Identity used throughout: at any point, market gain = value − cumulative net
 * contributions (`invested`). A period's market P&L is the change in that gain;
 * a period's contribution is the change in `invested`. The first point seeds the
 * opening balance so the per-year figures sum exactly to the totals.
 */

import type { ValuePoint } from './returns'

/** A dated income receipt (dividend or interest), in the series currency. */
export interface IncomeEvent {
  date: string
  amount: number
}

export interface PeriodAttribution {
  /** Calendar year, e.g. '2025'. */
  period: string
  /** Net contributions (deposits − withdrawals) during the period. */
  contribution: number
  /** Total market gain during the period (price + income). */
  marketPnl: number
  /** Price return during the period (market P&L excluding income). */
  pricePnl: number
  /** Income received during the period (dividends + interest). */
  income: number
  /** Portfolio value at the end of the period. */
  endValue: number
}

export interface ContributionDecomposition {
  /** Total net contributions since inception. */
  contributions: number
  /** Total market gain since inception (value − contributions = price + income). */
  marketGain: number
  /** Market gain from price moves (and other adjustments) since inception. */
  priceGain: number
  /** Total income (dividends + interest) since inception. */
  income: number
  /** Current portfolio value (contributions + marketGain). */
  endValue: number
  /** Market gain as a fraction of current value; null when value is zero. */
  marketShare: number | null
  /** Per-year breakdown, chronological. Sums to the totals above. */
  periods: PeriodAttribution[]
}

interface YearBucket {
  period: string
  contribution: number
  marketPnl: number
  endValue: number
}

export function decomposeContributions(
  points: ValuePoint[],
  income: IncomeEvent[] = [],
): ContributionDecomposition | null {
  if (points.length < 2) return null

  const first = points[0]!
  const last = points[points.length - 1]!
  const contributions = last.invested
  const marketGain = last.value - last.invested
  const endValue = last.value

  const incomeByYear = new Map<string, number>()
  for (const ev of income) {
    const year = ev.date.slice(0, 4)
    incomeByYear.set(year, (incomeByYear.get(year) ?? 0) + ev.amount)
  }

  const byYear = new Map<string, YearBucket>()
  // Seed the first year with the opening balance: the capital already invested
  // at the series start counts as contributed, any opening gain as market P&L.
  const firstYear = first.date.slice(0, 4)
  byYear.set(firstYear, {
    period: firstYear,
    contribution: first.invested,
    marketPnl: first.value - first.invested,
    endValue: first.value,
  })

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!
    const cur = points[i]!
    const flow = cur.invested - prev.invested
    const pnl = cur.value - prev.value - flow
    const year = cur.date.slice(0, 4)
    const bucket =
      byYear.get(year) ?? { period: year, contribution: 0, marketPnl: 0, endValue: cur.value }
    bucket.contribution += flow
    bucket.marketPnl += pnl
    bucket.endValue = cur.value
    byYear.set(year, bucket)
  }

  let totalIncome = 0
  const periods: PeriodAttribution[] = [...byYear.values()].map((b) => {
    const inc = incomeByYear.get(b.period) ?? 0
    totalIncome += inc
    return { ...b, income: inc, pricePnl: b.marketPnl - inc }
  })

  return {
    contributions,
    marketGain,
    priceGain: marketGain - totalIncome,
    income: totalIncome,
    endValue,
    marketShare: endValue !== 0 ? marketGain / endValue : null,
    periods,
  }
}
