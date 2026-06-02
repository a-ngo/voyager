'use client'

import { TrendingUp } from 'lucide-react'
import type { WidgetProps } from '../registry'
import { MOCK_TOTAL_RETURN } from '@/lib/portfolio/mock'

interface Config {
  timeRange: '1M' | '3M' | '6M' | '1Y' | '3Y' | 'ALL'
}

export default function TotalReturnWidget({ config }: WidgetProps<Config>) {
  const { pct, absolute, currency } = MOCK_TOTAL_RETURN
  const positive = pct >= 0
  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency })

  return (
    <div className="flex h-full flex-col justify-center">
      <span className="text-[10px] uppercase tracking-widest text-faint">
        Total return · {config.timeRange}
      </span>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={positive ? 'text-2xl font-semibold text-positive' : 'text-2xl font-semibold text-negative'}>
          {positive ? '+' : ''}
          {pct.toFixed(1)}%
        </span>
        <TrendingUp className={positive ? 'h-4 w-4 text-positive' : 'h-4 w-4 rotate-180 text-negative'} />
      </div>
      <span className="mt-0.5 text-xs text-muted tabular-nums">
        {positive ? '+' : ''}
        {fmt.format(absolute)}
      </span>
    </div>
  )
}
