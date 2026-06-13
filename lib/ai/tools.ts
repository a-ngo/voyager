import 'server-only'
import { tool } from 'ai'
import { z } from 'zod'
import { getDashboardSummary } from '@/lib/portfolio/valued-overview'

/** Round to keep tool payloads compact and avoid spurious float precision. */
function round(n: number, dp = 0): number {
  const f = 10 ** dp
  return Math.round(n * f) / f
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
        if (!s.hasData) {
          return { hasData: false as const }
        }
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
          targets: s.targets,
        }
      },
    }),
  }
}
