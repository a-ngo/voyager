'use client'

import type { WidgetProps } from '../registry'
import { SampleBadge } from '../WidgetState'
import { MOCK_ALLOCATION_TARGET } from '@/lib/portfolio/mock'

interface Config {
  threshold: number // drift threshold in percentage points
}

/**
 * Current vs. target allocation with signed drift per asset.
 * Diverging bars: current weight (filled) overlaid against the target marker.
 */
export default function AllocationTargetWidget({ config }: WidgetProps<Config>) {
  const max = Math.max(...MOCK_ALLOCATION_TARGET.flatMap((a) => [a.current, a.target]))

  return (
    <div className="relative flex h-full flex-col justify-center gap-2.5">
      <SampleBadge />
      {MOCK_ALLOCATION_TARGET.map((asset) => {
        const drift = asset.current - asset.target
        const breached = Math.abs(drift) > config.threshold
        return (
          <div key={asset.label} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: asset.color }} />
                <span className="text-foreground">{asset.label}</span>
              </span>
              <span className="flex items-center gap-2 tabular-nums">
                <span className="text-muted">
                  {asset.current}% / {asset.target}%
                </span>
                <span
                  className={
                    Math.abs(drift) < 0.05
                      ? 'text-faint'
                      : breached
                        ? 'text-negative'
                        : 'text-muted'
                  }
                >
                  {drift > 0 ? '+' : ''}
                  {drift}pp
                </span>
              </span>
            </div>
            <div className="relative h-2 rounded-sm bg-panel-elevated">
              {/* current weight bar */}
              <div
                className="absolute inset-y-0 left-0 rounded-sm"
                style={{ width: `${(asset.current / max) * 100}%`, background: asset.color }}
              />
              {/* target marker */}
              <div
                className="absolute inset-y-[-2px] w-0.5 bg-foreground"
                style={{ left: `${(asset.target / max) * 100}%` }}
                title={`Target ${asset.target}%`}
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
