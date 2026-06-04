'use client'

import { useQuery } from '@tanstack/react-query'
import type { DashboardSummary } from '@/lib/portfolio/valued-overview'

/** Client-side portfolio KPIs + allocation, fetched from /api/portfolio/summary. */
export function usePortfolioSummary() {
  return useQuery<DashboardSummary>({
    queryKey: ['portfolio-summary'],
    queryFn: async () => {
      const res = await fetch('/api/portfolio/summary')
      if (!res.ok) throw new Error('Failed to load portfolio summary')
      return res.json() as Promise<DashboardSummary>
    },
  })
}
