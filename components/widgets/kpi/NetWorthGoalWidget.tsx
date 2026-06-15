'use client'

import { Target } from 'lucide-react'
import type { WidgetProps } from '../registry'
import { WidgetMessage } from '../WidgetState'
import { usePortfolioSummary } from '@/hooks/usePortfolioSummary'

interface Config {
  goal: number
}

const DEFAULT_GOAL = 250_000

/** Total net worth vs. a savings goal, with progress toward the target. */
export default function NetWorthGoalWidget({ config }: WidgetProps<Config>) {
  const { data, isLoading, isError } = usePortfolioSummary()

  if (isLoading) return <WidgetMessage text="Loading…" />
  if (isError || !data) return <WidgetMessage text="Couldn't load data" />
  if (!data.hasData) return <WidgetMessage text="No data yet — import transactions" />

  const current = data.netWorth
  const currency = data.currency
  const goal = config.goal > 0 ? config.goal : DEFAULT_GOAL
  const pct = goal > 0 ? Math.min(100, (current / goal) * 100) : 0
  const remaining = Math.max(0, goal - current)

  const compact = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  })
  const full = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  })

  return (
    <div className="flex h-full flex-col justify-center gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-faint">Total net worth</span>
        <Target className="h-3.5 w-3.5 text-brand" />
      </div>

      <div className="flex items-baseline gap-2">
        <span className="anon-amount text-2xl font-semibold tabular-nums text-foreground">
          {full.format(current)}
        </span>
        <span className="text-xs text-muted">
          / <span className="anon-amount">{compact.format(goal)}</span> goal
        </span>
      </div>

      <div className="relative h-2 overflow-hidden rounded-full bg-panel-elevated">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand to-positive"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted">
        <span className="text-brand">{pct.toFixed(0)}% there</span>
        <span>
          <span className="anon-amount">{full.format(remaining)}</span> to go
        </span>
      </div>
    </div>
  )
}
