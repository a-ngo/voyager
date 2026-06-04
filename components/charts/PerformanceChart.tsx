'use client'

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import type { PerfPoint } from '@/lib/finance/performance'
import { formatMoney } from '@/lib/utils/format'

/** Portfolio value vs. net invested over time. Data passed in (presentational). */
export function PerformanceChart({
  points,
  currency,
}: {
  points: PerfPoint[]
  currency: string
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
      <ComposedChart data={points} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
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
          formatter={(value: number, name: string) => [formatMoney(value, currency), name]}
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
      </ComposedChart>
    </ResponsiveContainer>
  )
}
