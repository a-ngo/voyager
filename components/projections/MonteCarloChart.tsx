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
  ReferenceLine,
} from 'recharts'
import type { MonteCarloBand } from '@/lib/finance/montecarlo'

/** Fan chart: the 10th–90th percentile band as a shaded area, the median as a
 *  line, the invested baseline dashed, plus an optional target line. */
export function MonteCarloChart({
  bands,
  currency,
  target,
}: {
  bands: MonteCarloBand[]
  currency: string
  target?: number
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

  const data = bands.map((b) => ({
    year: b.year,
    p50: b.p50,
    invested: b.invested,
    range: [b.p10, b.p90] as [number, number],
  }))

  const dataMax = bands.reduce((max, b) => Math.max(max, b.p90), 0)
  const yMax = Math.max(dataMax, target ?? 0) * 1.05

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 12, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(125,120,110,0.25)" vertical={false} />
        <XAxis
          dataKey="year"
          type="number"
          domain={[0, 'dataMax']}
          allowDecimals={false}
          tickFormatter={(y: number) => `${y}y`}
          tick={{ fill: 'var(--color-faint)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          minTickGap={20}
        />
        <YAxis
          domain={[0, yMax]}
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
          labelFormatter={(y) => `Year ${y}`}
          formatter={(value: number | string | Array<number | string>, name: string) => {
            if (Array.isArray(value)) {
              const [lo, hi] = value
              return [`${fmtFull.format(Number(lo))} – ${fmtFull.format(Number(hi))}`, name]
            }
            return [fmtFull.format(Number(value)), name]
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="range"
          name="10th–90th percentile"
          stroke="none"
          fill="#5b9bff"
          fillOpacity={0.15}
        />
        <Line
          type="monotone"
          dataKey="p50"
          name="Median"
          stroke="#5b9bff"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="invested"
          name="Invested"
          stroke="#8a8a8a"
          strokeDasharray="4 4"
          strokeWidth={1.5}
          dot={false}
        />
        {target != null && target > 0 && (
          <ReferenceLine
            y={target}
            stroke="var(--color-foreground)"
            strokeOpacity={0.5}
            strokeDasharray="5 5"
            label={{
              value: 'Target',
              position: 'insideTopRight',
              fill: 'var(--color-muted)',
              fontSize: 11,
            }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
