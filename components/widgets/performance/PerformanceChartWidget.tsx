'use client'

import type { WidgetProps } from '../registry'
import { WidgetMessage } from '../WidgetState'
import { PerformanceChart } from '@/components/charts/PerformanceChart'
import { usePerformanceSeries } from '@/hooks/usePerformanceSeries'

interface Config {
  timeRange: '1M' | '3M' | '6M' | '1Y' | '3Y' | 'ALL'
  showBenchmark: boolean
  benchmarkTicker?: string
}

export default function PerformanceChartWidget(_props: WidgetProps<Config>) {
  const { data, isLoading, isError } = usePerformanceSeries()

  if (isLoading) return <WidgetMessage text="Loading…" />
  if (isError || !data) return <WidgetMessage text="Couldn't load data" />
  if (!data.hasData) return <WidgetMessage text="No data yet — import transactions" />
  if (!data.hasKey) return <WidgetMessage text="Set STOOQ_API_KEY to enable historical performance" />
  if (data.points.length === 0) return <WidgetMessage text="No price history available" />

  return <PerformanceChart points={data.points} currency={data.currency} />
}
