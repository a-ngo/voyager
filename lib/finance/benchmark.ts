import { priceAt, type PricePoint } from './performance'

/**
 * "Alternative reality" benchmarks: replay the portfolio's own external
 * contributions into a fixed-weight basket of index ETFs, then compare that
 * net-worth line against the real portfolio. Answers "what if I'd just bought
 * the index with the same money?".
 *
 * Components are EUR-listed ETFs, so the replay needs no FX. Pure module — price
 * series and contribution events are passed in.
 */

export interface BenchmarkComponent {
  /** Yahoo symbol — must be EUR-quoted. */
  symbol: string
  weight: number
}

export interface BenchmarkDef {
  id: string
  label: string
  description: string
  /** Line colour on the chart. */
  color: string
  components: BenchmarkComponent[]
}

/** Selectable strategies. Extend here; the UI and API derive from this list. */
export const BENCHMARKS: BenchmarkDef[] = [
  {
    id: 'msci-acwi',
    label: 'MSCI All-World',
    description: 'Everything into iShares MSCI ACWI (IUSQ).',
    color: '#5f8d6a',
    components: [{ symbol: 'IUSQ.DE', weight: 1 }],
  },
  {
    id: 'world-em-70-30',
    label: '70/30 World + EM',
    description: '70% MSCI World (IWDA), 30% MSCI EM IMI (IS3N).',
    color: '#9b7bb5',
    components: [
      { symbol: 'IWDA.AS', weight: 0.7 },
      { symbol: 'IS3N.DE', weight: 0.3 },
    ],
  },
  {
    id: 'sp500',
    label: 'S&P 500',
    description: 'Everything into iShares Core S&P 500 (SXR8).',
    color: '#c9a14a',
    components: [{ symbol: 'SXR8.DE', weight: 1 }],
  },
  {
    id: 'nasdaq-100',
    label: 'Nasdaq-100',
    description: 'Everything into iShares Nasdaq-100 (SXRV).',
    color: '#3f9aa0',
    components: [{ symbol: 'SXRV.DE', weight: 1 }],
  },
]

export function getBenchmark(id: string): BenchmarkDef | undefined {
  return BENCHMARKS.find((b) => b.id === id)
}

/** A dated external cashflow: deposits positive, withdrawals negative (EUR). */
export interface ContributionEvent {
  date: string
  amount: number
}

export interface ResolvedComponent {
  weight: number
  points: PricePoint[] // ascending, EUR
}

export interface BenchmarkPoint {
  date: string
  benchmark: number // EUR value of the replayed strategy at this date
}

/**
 * Buy price for a contribution: forward-fill (most recent close ≤ date), falling
 * back to the earliest known close for contributions made before the component's
 * history starts. Monthly history begins at a month boundary, so a contribution
 * in that first partial month would otherwise be dropped (it can be a large
 * opening transfer) — back-filling invests it at the earliest available price.
 */
function buyPriceAt(points: PricePoint[], date: string): number | null {
  return priceAt(points, date) ?? points[0]?.close ?? null
}

/**
 * Replay contributions into a fixed-weight basket. Each contribution buys every
 * component at that date's price, split by weight (buy-and-hold; the basket
 * rebalances only through new contributions). Contributions must be ascending by
 * date.
 */
export function replayBenchmark(
  contributions: ContributionEvent[],
  components: ResolvedComponent[],
  dates: string[],
): BenchmarkPoint[] {
  return dates.map((date) => {
    let value = 0
    for (const c of components) {
      let units = 0
      for (const ev of contributions) {
        if (ev.date > date) break
        const buyPrice = buyPriceAt(c.points, ev.date)
        if (buyPrice && buyPrice > 0) units += (ev.amount * c.weight) / buyPrice
      }
      const px = priceAt(c.points, date)
      if (px != null) value += units * px
    }
    return { date, benchmark: value }
  })
}
