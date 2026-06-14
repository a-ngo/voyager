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
  ReferenceDot,
} from 'recharts'

export interface ScenarioLine {
  id: string
  label: string
  color: string
}

/** Where a scenario crosses the target: plotted as a dot on the target line. */
export interface TargetMarker {
  id: string
  color: string
  year: number
}

/** Projected value over time: an "invested" baseline area + one line per scenario,
 *  plus an optional target line and the year each scenario reaches it. */
export function ProjectionChart({
  data,
  scenarios,
  currency,
  target,
  markers = [],
}: {
  data: Record<string, number>[]
  scenarios: ScenarioLine[]
  currency: string
  target?: number
  markers?: TargetMarker[]
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

  const dataMax = data.reduce(
    (max, row) => Math.max(max, ...scenarios.map((s) => row[s.id] ?? 0)),
    0,
  )
  const yMax = Math.max(dataMax, target ?? 0) * 1.05

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 12, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="investedFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8a8a8a" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#8a8a8a" stopOpacity={0} />
          </linearGradient>
        </defs>
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
          formatter={(value: number, name: string) => [fmtFull.format(value), name]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="invested"
          name="Invested"
          stroke="#8a8a8a"
          strokeDasharray="4 4"
          fill="url(#investedFill)"
          strokeWidth={1.5}
        />
        {scenarios.map((s) => (
          <Line
            key={s.id}
            type="monotone"
            dataKey={s.id}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
          />
        ))}
        {target != null && target > 0 && (
          <ReferenceLine
            y={target}
            stroke="var(--color-foreground)"
            strokeOpacity={0.5}
            strokeDasharray="5 5"
            label={{
              value: `Target ${fmtCompact.format(target)}`,
              position: 'insideTopRight',
              fill: 'var(--color-muted)',
              fontSize: 11,
            }}
          />
        )}
        {target != null &&
          markers.map((m) => (
            <ReferenceDot
              key={m.id}
              x={m.year}
              y={target}
              r={5}
              fill={m.color}
              stroke="var(--color-panel)"
              strokeWidth={2}
              label={{ value: `${m.year}y`, position: 'top', fill: m.color, fontSize: 11 }}
            />
          ))}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
