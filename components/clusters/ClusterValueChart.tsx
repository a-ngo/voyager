'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'

export interface ClusterLine {
  id: string
  name: string
  color: string
}

/** Each cluster's EUR market value over time, overlaid as one line per cluster. */
export function ClusterValueChart({
  data,
  lines,
  currency,
}: {
  data: Record<string, number | string>[]
  lines: ClusterLine[]
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

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 12, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(125,120,110,0.25)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => d.slice(0, 7)}
          tick={{ fill: 'var(--color-faint)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          minTickGap={28}
        />
        <YAxis
          tickFormatter={(v: number) => fmtCompact.format(v)}
          tick={{ fill: 'var(--color-faint)', fontSize: 11 }}
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
          labelFormatter={(d) => `${d}`}
          formatter={(value: number, name: string) => [fmtFull.format(value), name]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {lines.map((l) => (
          <Line
            key={l.id}
            type="monotone"
            dataKey={l.id}
            name={l.name}
            stroke={l.color}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
