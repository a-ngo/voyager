'use client'

import type { WidgetProps } from '../registry'
import { WidgetMessage } from '../WidgetState'
import { AllocationDonut } from '@/components/charts/AllocationDonut'
import { usePortfolioSummary } from '@/hooks/usePortfolioSummary'

interface Config {
  groupBy: 'asset' | 'sector' | 'geography' | 'currency'
}

export default function AllocationPieWidget(_props: WidgetProps<Config>) {
  const { data, isLoading, isError } = usePortfolioSummary()

  if (isLoading) return <WidgetMessage text="Loading…" />
  if (isError || !data) return <WidgetMessage text="Couldn't load data" />
  if (!data.hasData || data.allocation.length === 0) {
    return <WidgetMessage text="No data yet — import transactions" />
  }

  return (
    <div className="flex h-full items-center">
      <AllocationDonut slices={data.allocation} currency={data.currency} />
    </div>
  )
}
