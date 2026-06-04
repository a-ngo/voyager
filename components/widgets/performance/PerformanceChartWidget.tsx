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
import type { WidgetProps } from '../registry'
import { MOCK_PERFORMANCE } from '@/lib/portfolio/mock'

interface Config {
  timeRange: '1M' | '3M' | '6M' | '1Y' | '3Y' | 'ALL'
  showBenchmark: boolean
  benchmarkTicker?: string
}

const BENCHMARK_LABELS: Record<string, string> = {
  'IWDA.AS': 'MSCI World (IWDA.AS)',
  'XDWD.DE': 'MSCI World (XDWD.DE)',
}

export default function PerformanceChartWidget({ config }: WidgetProps<Config>) {
  const benchmarkLabel = config.benchmarkTicker
    ? (BENCHMARK_LABELS[config.benchmarkTicker] ?? config.benchmarkTicker)
    : 'Benchmark'
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={MOCK_PERFORMANCE} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c2613f" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#c2613f" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(125,120,110,0.25)" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: '#9d968a', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#9d968a', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            background: 'var(--color-panel)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--color-foreground)',
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" />
        <Area
          type="monotone"
          dataKey="portfolio"
          name="Portfolio"
          stroke="#c2613f"
          strokeWidth={2}
          fill="url(#portfolioFill)"
        />
        {config.showBenchmark && (
          <Line
            type="monotone"
            dataKey="benchmark"
            name={benchmarkLabel}
            stroke="#6f94a6"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
