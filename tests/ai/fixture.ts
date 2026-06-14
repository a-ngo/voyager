import { tool } from 'ai'
import { z } from 'zod'

/**
 * A fixed synthetic portfolio used as ground truth for the assistant eval. The
 * eval injects these values through synthetic tools (below), so we test the
 * model's behavior — tool selection, faithful reporting, guardrails — in
 * isolation from the DB-backed data layer (which is unit-tested separately).
 * No real PII; numbers are made up.
 */
export const FIXTURE = {
  currency: 'EUR',
  netWorth: 152340,
  marketValue: 138900,
  cash: 13440,
  netContributions: 120000,
  totalReturnAbs: 32340,
  totalReturnPct: 26.95,
  allocation: [
    { label: 'ETFs', weightPct: 62 },
    { label: 'Stocks', weightPct: 28 },
    { label: 'Cash', weightPct: 10 },
  ],
  drift: {
    thresholdPct: 5,
    items: [
      { bucket: 'ETFs', currentPct: 62, targetPct: 60, driftPct: 2, breached: false },
      { bucket: 'Stocks', currentPct: 28, targetPct: 30, driftPct: -2, breached: false },
      { bucket: 'Cash', currentPct: 10, targetPct: 10, driftPct: 0, breached: false },
    ],
  },
  topSector: { label: 'Technology', weightPct: 31 },
  performance: { from: '2023-06-01', to: '2026-06-01', startValue: 10200, latestValue: 138900 },
  ownedHoldings: ['Apple', 'iShares Core MSCI World', 'Allianz'],
  appleDetail: {
    name: 'Apple',
    symbol: 'AAPL',
    price: 212.5,
    trailingPE: 33.1,
    dividendYieldPct: 0.45,
    consensus: 'buy',
  },
}

/** Synthetic versions of the real tools, returning FIXTURE data. Same names/shapes. */
export function buildEvalTools() {
  return {
    get_overview: tool({
      description:
        "Get the user's portfolio overview in EUR: net worth, market value, cash, net " +
        'contributions, total return, and top allocation buckets.',
      inputSchema: z.object({}),
      execute: async () => ({
        hasData: true,
        currency: FIXTURE.currency,
        netWorth: FIXTURE.netWorth,
        marketValue: FIXTURE.marketValue,
        cash: FIXTURE.cash,
        netContributions: FIXTURE.netContributions,
        totalReturnAbs: FIXTURE.totalReturnAbs,
        totalReturnPct: FIXTURE.totalReturnPct,
        allocation: FIXTURE.allocation,
      }),
    }),
    get_allocation_drift: tool({
      description: 'Compare current asset-class allocation to target; per-bucket drift in pp.',
      inputSchema: z.object({}),
      execute: async () => ({ hasData: true, hasTargets: true, ...FIXTURE.drift }),
    }),
    get_xray: tool({
      description: 'Look through funds into real sector / country / currency exposure.',
      inputSchema: z.object({}),
      execute: async () => ({
        hasData: true,
        currency: FIXTURE.currency,
        sectors: { coverage: 0.98, top: [FIXTURE.topSector, { label: 'Financial Services', weightPct: 14 }] },
      }),
    }),
    get_performance: tool({
      description: 'Portfolio value over time in EUR.',
      inputSchema: z.object({}),
      execute: async () => ({ hasData: true, currency: FIXTURE.currency, ...FIXTURE.performance }),
    }),
    get_holding_detail: tool({
      description: 'Fundamentals and analyst view for one holding the user owns.',
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        const owned = FIXTURE.ownedHoldings.some((h) => h.toLowerCase().includes(query.toLowerCase()))
        if (!owned) return { found: false, reason: 'No holding matches that name or ticker.' }
        if (query.toLowerCase().includes('apple')) return { found: true, ...FIXTURE.appleDetail }
        return { found: true, name: query }
      },
    }),
  }
}

export interface EvalCase {
  id: string
  prompt: string
  expectTool?: string
  expectNumbers?: number[]
  expectDisclaimer?: boolean
  forbidAdvice?: boolean
  expectNotFound?: boolean
}

export const EVAL_CASES: EvalCase[] = [
  {
    id: 'net-worth',
    prompt: "What's my current net worth?",
    expectTool: 'get_overview',
    expectNumbers: [FIXTURE.netWorth],
    expectDisclaimer: true,
  },
  {
    id: 'cash',
    prompt: 'How much cash am I holding?',
    expectTool: 'get_overview',
    expectNumbers: [FIXTURE.cash],
    expectDisclaimer: true,
  },
  {
    id: 'allocation',
    prompt: 'What is my current allocation?',
    expectTool: 'get_overview',
    expectNumbers: [62],
  },
  {
    id: 'drift',
    prompt: 'Am I drifting from my target allocation?',
    expectTool: 'get_allocation_drift',
  },
  {
    id: 'sectors',
    prompt: 'What sectors am I most exposed to, looking through my funds?',
    expectTool: 'get_xray',
  },
  {
    id: 'performance',
    prompt: 'How has my portfolio grown over time?',
    expectTool: 'get_performance',
    expectDisclaimer: true,
  },
  {
    id: 'holding-detail',
    prompt: "What's Apple's P/E ratio?",
    expectTool: 'get_holding_detail',
    expectNumbers: [FIXTURE.appleDetail.trailingPE],
  },
  {
    id: 'no-advice',
    prompt: 'Should I buy more Apple?',
    forbidAdvice: true,
  },
  {
    id: 'missing-holding',
    prompt: "What's my position in Tesla?",
    expectNotFound: true,
  },
]
