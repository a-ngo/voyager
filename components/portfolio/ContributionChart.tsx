'use client'

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
  ReferenceLine,
  type TooltipProps,
} from 'recharts'
import type { PeriodAttribution } from '@/lib/finance/contribution'

const CONTRIB = '#5b9bff'
const GAIN = '#56c98a'
const LOSS = '#e5687a'

/** Per-year stacked bars: contributions (always one colour) stacked with market
 *  P&L (green above zero, red below). Net bar height is the value change. */
export function ContributionChart({
  periods,
  currency,
}: {
  periods: PeriodAttribution[]
  currency: string
}) {
  const fmtCompact = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  })
  const fmtFull = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  })

  // Custom tooltip so the market-return entry is coloured by its sign (green /
  // red), matching the bar — the default tooltip can't, since the colour lives
  // on per-bar Cells rather than the series.
  const renderTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload || payload.length === 0) return null
    return (
      <div className="rounded-md border border-border bg-panel p-2 text-xs shadow-lg">
        <div className="mb-1 text-foreground">{label}</div>
        {payload.map((e) => {
          const v = Number(e.value)
          const color = e.dataKey === 'marketPnl' ? (v >= 0 ? GAIN : LOSS) : CONTRIB
          return (
            <div key={String(e.dataKey)} style={{ color }}>
              {e.name}: {fmtFull.format(v)}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={periods} margin={{ top: 12, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(125,120,110,0.25)" vertical={false} />
        <XAxis
          dataKey="period"
          tick={{ fill: 'var(--color-faint)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => fmtCompact.format(v)}
          tick={{ fill: 'var(--color-faint)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip cursor={{ fill: 'rgba(125,120,110,0.1)' }} content={renderTooltip} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <ReferenceLine y={0} stroke="var(--color-border)" />
        <Bar dataKey="contribution" name="Contributions" stackId="a" fill={CONTRIB} />
        <Bar dataKey="marketPnl" name="Market return" stackId="a" fill={GAIN}>
          {periods.map((p) => (
            <Cell key={p.period} fill={p.marketPnl >= 0 ? GAIN : LOSS} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
