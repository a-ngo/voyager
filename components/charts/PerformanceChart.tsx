'use client'

import {
  ComposedChart,
  Area,
  Line,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import type { PerfPoint } from '@/lib/finance/performance'
import { formatMoney } from '@/lib/utils/format'

/** A benchmark overlay: read `points[].<key>`, label and colour the line. */
export interface BenchmarkLine {
  key: string
  label: string
  color: string
}

/** Portfolio value vs. net invested over time. Data passed in (presentational). */
export function PerformanceChart({
  points,
  currency,
  benchmarks = [],
  showTrades = false,
  onMonthClick,
}: {
  points: PerfPoint[]
  currency: string
  /** Overlaid benchmark lines. Each reads its own `key` from the data points
   * (merged in by the caller) and is plotted by Recharts via that dataKey. */
  benchmarks?: BenchmarkLine[]
  /** Plot buy/sell markers from each point's `buyMarker`/`sellMarker` field. */
  showTrades?: boolean
  /** Called with the clicked point's date (YYYY-MM-DD) when a month is clicked. */
  onMonthClick?: (date: string) => void
}) {
  const fmtCompact = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  })
  const fmtMonth = (d: string) =>
    new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(new Date(d))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={points}
        margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
        onClick={(state: { activeLabel?: string | number }) => {
          const label = state?.activeLabel
          if (label != null && onMonthClick) onMonthClick(String(label))
        }}
        style={onMonthClick ? { cursor: 'pointer' } : undefined}
      >
        <defs>
          <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c2613f" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#c2613f" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(125,120,110,0.25)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtMonth}
          tick={{ fill: '#9d968a', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          tickFormatter={(v: number) => fmtCompact.format(v)}
          tick={{ fill: '#9d968a', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--color-panel)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--color-foreground)',
          }}
          labelFormatter={(d) => fmtMonth(String(d))}
          formatter={(value: number, name: string, item: { payload?: { tradeFlow?: number } }) => {
            // Markers sit at portfolio value; show the actual net € traded instead.
            if (name === 'Net buy' || name === 'Net sell') {
              return [formatMoney(Math.abs(item.payload?.tradeFlow ?? 0), currency), name]
            }
            return [formatMoney(value, currency), name]
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" />
        <Area
          type="monotone"
          dataKey="value"
          name="Portfolio value"
          stroke="#c2613f"
          strokeWidth={2}
          fill="url(#valueFill)"
        />
        <Line
          type="monotone"
          dataKey="invested"
          name="Net invested"
          stroke="#6f94a6"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          dot={false}
        />
        {benchmarks.map((b) => (
          <Line
            key={b.key}
            type="monotone"
            dataKey={b.key}
            name={b.label}
            stroke={b.color}
            strokeWidth={1.75}
            dot={false}
            connectNulls
          />
        ))}
        {showTrades && <ZAxis dataKey="tradeMag" range={[40, 500]} />}
        {showTrades && <Scatter dataKey="buyMarker" name="Net buy" fill="#5b8c5a" shape="circle" />}
        {showTrades && <Scatter dataKey="sellMarker" name="Net sell" fill="#c0584e" shape="circle" />}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
