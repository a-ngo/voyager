'use client'

import Link from 'next/link'
import type { WidgetProps } from '../registry'
import { WidgetMessage } from '../WidgetState'
import { usePortfolioSummary } from '@/hooks/usePortfolioSummary'
import { buildTargetComparison } from '@/lib/portfolio/targets'

interface Config {
  threshold: number // drift threshold in percentage points
}

/**
 * Current vs. target allocation with signed drift per asset class.
 * Diverging bars: current weight (filled) overlaid against the target marker.
 */
export default function AllocationTargetWidget({ config }: WidgetProps<Config>) {
  const { data, isLoading, isError } = usePortfolioSummary()

  if (isLoading) return <WidgetMessage text="Loading…" />
  if (isError || !data) return <WidgetMessage text="Couldn't load data" />
  if (!data.hasData) return <WidgetMessage text="No data yet — import transactions" />

  if (Object.keys(data.targets).length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-muted">
        <span>No target allocation set.</span>
        <Link href="/settings" className="text-brand hover:underline">
          Set targets in Settings →
        </Link>
      </div>
    )
  }

  const rows = buildTargetComparison(data.allocation, data.targets)
  const max = Math.max(1, ...rows.flatMap((r) => [r.current, r.target]))

  return (
    <div className="flex h-full flex-col justify-center gap-2.5">
      {rows.map((row) => {
        const breached = Math.abs(row.drift) > config.threshold
        return (
          <div key={row.bucket} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: row.color }} />
                <span className="text-foreground">{row.label}</span>
              </span>
              <span className="flex items-center gap-2 tabular-nums">
                <span className="text-muted">
                  {row.current.toFixed(1)}% / {row.target.toFixed(0)}%
                </span>
                <span
                  className={
                    Math.abs(row.drift) < 0.05
                      ? 'text-faint'
                      : breached
                        ? 'text-negative'
                        : 'text-muted'
                  }
                >
                  {row.drift > 0 ? '+' : ''}
                  {row.drift.toFixed(1)}pp
                </span>
              </span>
            </div>
            <div className="relative h-2 rounded-sm bg-panel-elevated">
              <div
                className="absolute inset-y-0 left-0 rounded-sm"
                style={{ width: `${(row.current / max) * 100}%`, background: row.color }}
              />
              <div
                className="absolute inset-y-[-2px] w-0.5 bg-foreground"
                style={{ left: `${(row.target / max) * 100}%` }}
                title={`Target ${row.target}%`}
              />
            </div>
          </div>
        )
      })}
      <div className="mt-1 flex items-center gap-3 text-[10px] text-faint">
        <span className="flex items-center gap-1">
          <span className="h-2 w-3 rounded-sm bg-muted" /> Current
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-0.5 bg-foreground" /> Target
        </span>
      </div>
    </div>
  )
}
