'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { formatMoney } from '@/lib/utils/format'

export interface DonutSlice {
  label: string
  value: number
  weight: number
  color: string
}

/** Donut + legend for a cost-basis allocation. Data is passed in (presentational). */
export function AllocationDonut({
  slices,
  currency,
}: {
  slices: DonutSlice[]
  currency: string
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius="55%"
              outerRadius="85%"
              paddingAngle={2}
              stroke="none"
            >
              {slices.map((s) => (
                <Cell key={s.label} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#21252b',
                border: '1px solid #2f3540',
                borderRadius: 6,
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => [formatMoney(value, currency), name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-1 flex-col gap-1.5 text-xs">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="text-muted">{s.label}</span>
            <span className="ml-auto tabular-nums text-foreground">{s.weight.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
