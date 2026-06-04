'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { WidgetProps } from '../registry'
import { MOCK_ALLOCATION } from '@/lib/portfolio/mock'

interface Config {
  groupBy: 'asset' | 'sector' | 'geography' | 'currency'
}

export default function AllocationPieWidget(_props: WidgetProps<Config>) {
  return (
    <div className="flex h-full items-center gap-3">
      <div className="h-full min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={MOCK_ALLOCATION}
              dataKey="value"
              nameKey="label"
              innerRadius="55%"
              outerRadius="85%"
              paddingAngle={2}
              stroke="none"
            >
              {MOCK_ALLOCATION.map((slice) => (
                <Cell key={slice.label} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'var(--color-panel)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--color-foreground)',
              }}
              formatter={(value: number, name: string) => [`${value}%`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-col gap-1.5 pr-1 text-xs">
        {MOCK_ALLOCATION.map((slice) => (
          <li key={slice.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: slice.color }} />
            <span className="text-muted">{slice.label}</span>
            <span className="ml-auto tabular-nums text-foreground">{slice.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
