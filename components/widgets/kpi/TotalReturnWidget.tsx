'use client'

import { TrendingUp } from 'lucide-react'
import type { WidgetProps } from '../registry'
import { WidgetMessage } from '../WidgetState'
import { usePortfolioSummary } from '@/hooks/usePortfolioSummary'

interface Config {
  timeRange: '1M' | '3M' | '6M' | '1Y' | '3Y' | 'ALL'
}

export default function TotalReturnWidget(_props: WidgetProps<Config>) {
  const { data, isLoading, isError } = usePortfolioSummary()

  if (isLoading) return <WidgetMessage text="Loading…" />
  if (isError || !data) return <WidgetMessage text="Couldn't load data" />
  if (!data.hasData) return <WidgetMessage text="No data yet — import transactions" />

  const { totalReturnPct: pct, totalReturnAbs: absolute, currency } = data
  const positive = pct >= 0
  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency })

  return (
    <div className="flex h-full flex-col justify-center">
      <span className="text-[10px] uppercase tracking-widest text-faint">
        Total return · all-time
      </span>
      <div className="mt-1 flex items-baseline gap-2">
        <span
          className={
            positive
              ? 'text-2xl font-semibold text-positive'
              : 'text-2xl font-semibold text-negative'
          }
        >
          {positive ? '+' : ''}
          {pct.toFixed(1)}%
        </span>
        <TrendingUp
          className={positive ? 'h-4 w-4 text-positive' : 'h-4 w-4 rotate-180 text-negative'}
        />
      </div>
      <span className="anon-amount mt-0.5 text-xs tabular-nums text-muted">
        {positive ? '+' : ''}
        {fmt.format(absolute)}
      </span>
    </div>
  )
}
