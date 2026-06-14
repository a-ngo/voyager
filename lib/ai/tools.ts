import 'server-only'
import { tool } from 'ai'
import { z } from 'zod'
import {
  getDashboardSummary,
  getValuedOverview,
  type ValuedOverviewPosition,
} from '@/lib/portfolio/valued-overview'
import { computeDrift } from '@/lib/finance/drift'
import { BUCKET_LABEL, type Bucket } from '@/lib/portfolio/buckets'
import { getXray } from '@/lib/portfolio/xray'
import { getPerformanceSeries } from '@/lib/portfolio/performance-series'
import { fetchInstrumentDetail } from '@/lib/prices/yahoo-fundamentals'

/** Drift threshold in percentage points — a bucket past this counts as breached. */
const DRIFT_THRESHOLD_PCT = 5

/** Round to keep tool payloads compact and avoid spurious float precision. */
function round(n: number, dp = 0): number {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

/** Evenly downsample an array to at most `n` items, always keeping first and last. */
function sample<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items
  const step = (items.length - 1) / (n - 1)
  const out: T[] = []
  for (let i = 0; i < n; i++) {
    const item = items[Math.round(i * step)]
    if (item !== undefined) out.push(item)
  }
  return out
}

/** Find one of the user's holdings by name, ticker, or ISIN (case-insensitive). */
function findPosition(
  positions: ValuedOverviewPosition[],
  names: Record<string, string>,
  query: string,
): ValuedOverviewPosition | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  return (
    positions.find((p) => {
      const ticker = p.ticker?.toLowerCase() ?? ''
      const isin = p.isin?.toLowerCase() ?? ''
      const label = p.label?.toLowerCase() ?? ''
      const name = (p.isin ? (names[p.isin] ?? '') : '').toLowerCase()
      return ticker === q || isin === q || label.includes(q) || name.includes(q)
    }) ?? null
  )
}

/**
 * Tools the assistant can call, auth-scoped to one user. `userId` is closed over
 * from the verified session — it is never a tool argument the model can set.
 * Each tool wraps an existing, tested data function and returns a compact
 * summary (never raw transactions or positions).
 */
export function buildTools(userId: string) {
  return {
    get_overview: tool({
      description:
        "Get the user's current portfolio overview in EUR: net worth, market value, cash, " +
        'net contributions, total return (absolute and %), unrealized/realized P/L, income, ' +
        'how many holdings are unpriced, and the top allocation buckets with their weights. ' +
        'Call this to answer questions about overall value, returns, cash, or allocation.',
      inputSchema: z.object({}),
      execute: async () => {
        const s = await getDashboardSummary(userId)
        if (!s.hasData) return { hasData: false as const }
        return {
          hasData: true as const,
          currency: s.currency,
          asOf: s.asOf,
          netWorth: round(s.netWorth),
          marketValue: round(s.marketValue),
          cash: round(s.cash),
          netContributions: round(s.netContributions),
          totalReturnAbs: round(s.totalReturnAbs),
          totalReturnPct: round(s.totalReturnPct, 2),
          unrealizedPnl: round(s.unrealizedPnl),
          realizedPnl: round(s.realizedPnl),
          income: round(s.income),
          unpricedCount: s.unpricedCount,
          allocation: s.allocation.map((a) => ({
            label: a.label,
            weightPct: round(a.weight, 1),
            value: round(a.value),
          })),
        }
      },
    }),

    get_allocation_drift: tool({
      description:
        "Compare the user's current asset-class allocation to their target allocation. " +
        `Returns per-bucket current %, target %, and signed drift in percentage points; a ` +
        `bucket drifting more than ${DRIFT_THRESHOLD_PCT}pp is flagged as breached. Use this for ` +
        'questions about rebalancing or being over/underweight. If no targets are set, says so.',
      inputSchema: z.object({}),
      execute: async () => {
        const s = await getDashboardSummary(userId)
        if (!s.hasData) return { hasData: false as const }
        const hasTargets = Object.keys(s.targets).length > 0
        const current: Record<string, number> = {}
        for (const slice of s.allocation) current[slice.bucket] = slice.weight
        const report = computeDrift(current, s.targets, DRIFT_THRESHOLD_PCT)
        return {
          hasData: true as const,
          hasTargets,
          thresholdPct: DRIFT_THRESHOLD_PCT,
          anyBreached: hasTargets && report.anyBreached,
          maxAbsDriftPct: round(report.maxAbsDrift, 1),
          items: report.items
            .filter((i) => i.current > 0.05 || i.target > 0.05)
            .map((i) => ({
              bucket: BUCKET_LABEL[i.key as Bucket] ?? i.key,
              currentPct: round(i.current, 1),
              targetPct: round(i.target, 1),
              driftPct: round(i.drift, 1),
              breached: i.breached,
            })),
        }
      },
    }),

    get_xray: tool({
      description:
        'Look through the portfolio (including inside ETFs) into real exposure: asset mix, ' +
        'sector / country / currency breakdowns (each with a 0..1 coverage figure), the top ' +
        'look-through holdings, and concentration stats. Use for "what am I really exposed to", ' +
        'sector/region/currency questions, or concentration/diversification questions.',
      inputSchema: z.object({}),
      execute: async () => {
        const x = await getXray(userId)
        if (!x.hasData) return { hasData: false as const }
        const breakdown = (b: { slices: { label: string; weight: number }[]; coverage: number }) => ({
          coverage: round(b.coverage, 2),
          top: b.slices.slice(0, 8).map((s) => ({ label: s.label, weightPct: round(s.weight, 1) })),
        })
        return {
          hasData: true as const,
          currency: x.currency,
          total: round(x.total),
          assetMix: x.assetMix.map((s) => ({ label: s.label, weightPct: round(s.weight, 1) })),
          sectors: breakdown(x.sectors),
          countries: breakdown(x.countries),
          currencies: breakdown(x.currencies),
          topHoldings: x.topHoldings.slice(0, 10).map((h) => ({
            name: h.name,
            weightPct: round(h.weight, 1),
            via: h.via,
          })),
          concentration: {
            holdings: x.concentration.holdings,
            top10WeightPct: round(x.concentration.top10Weight, 1),
            largestWeightPct: round(x.concentration.largestWeight, 1),
            effectiveHoldings: round(x.concentration.effectiveHoldings, 1),
          },
        }
      },
    }),

    get_performance: tool({
      description:
        "Get the user's portfolio value over time in EUR: start and latest value, net invested, " +
        'absolute return, and a downsampled trajectory of value vs. invested. Use for questions ' +
        'about growth over time, how the portfolio has performed, or value at a point in time.',
      inputSchema: z.object({}),
      execute: async () => {
        const p = await getPerformanceSeries(userId)
        if (!p.hasData || p.points.length === 0) return { hasData: false as const }
        const first = p.points[0]
        const last = p.points[p.points.length - 1]
        if (!first || !last) return { hasData: false as const }
        return {
          hasData: true as const,
          currency: p.currency,
          from: first.date,
          to: last.date,
          pointCount: p.points.length,
          startValue: round(first.value),
          latestValue: round(last.value),
          netInvested: round(last.invested),
          absReturn: round(last.value - last.invested),
          series: sample(p.points, 12).map((pt) => ({
            date: pt.date,
            value: round(pt.value),
            invested: round(pt.invested),
          })),
        }
      },
    }),

    get_holding_detail: tool({
      description:
        'Fundamentals and analyst view for one holding the user owns: price, market cap, P/E ' +
        '(trailing/forward), dividend yield, beta, profit margin, ROE, 52-week range, analyst ' +
        'price targets (low/mean/high), and consensus rating. Pass the holding name or ticker.',
      inputSchema: z.object({
        query: z.string().describe('Holding name or ticker, e.g. "Apple" or "AAPL"'),
      }),
      execute: async ({ query }) => {
        const o = await getValuedOverview(userId)
        const match = findPosition(o.positions, o.names, query)
        if (!match) {
          return { found: false as const, reason: 'No holding matches that name or ticker.' }
        }
        if (!match.ticker) {
          return {
            found: false as const,
            reason: `Holding "${match.label}" has no resolved market symbol yet, so fundamentals aren't available.`,
          }
        }
        const d = await fetchInstrumentDetail(match.ticker)
        if (!d) {
          return { found: false as const, reason: `No market data available for ${match.ticker}.` }
        }
        return {
          found: true as const,
          name: d.name ?? match.label,
          symbol: d.symbol,
          currency: d.currency,
          price: d.price,
          marketCap: d.marketCap,
          trailingPE: d.trailingPE,
          forwardPE: d.forwardPE,
          dividendYieldPct: d.dividendYield == null ? null : round(d.dividendYield * 100, 2),
          beta: d.beta,
          profitMarginPct: d.profitMargin == null ? null : round(d.profitMargin * 100, 1),
          returnOnEquityPct: d.returnOnEquity == null ? null : round(d.returnOnEquity * 100, 1),
          fiftyTwoWeekLow: d.fiftyTwoWeekLow,
          fiftyTwoWeekHigh: d.fiftyTwoWeekHigh,
          sector: d.sector,
          industry: d.industry,
          analystTargets: { low: d.targetLow, mean: d.targetMean, high: d.targetHigh },
          consensus: d.recommendationKey,
          numberOfAnalysts: d.numberOfAnalysts,
        }
      },
    }),
  }
}
