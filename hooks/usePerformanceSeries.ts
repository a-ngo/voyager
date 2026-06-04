'use client'

import { useQuery } from '@tanstack/react-query'
import type { PerformanceSeries } from '@/lib/portfolio/performance-series'

/** Client-side portfolio value-over-time, from /api/portfolio/performance. */
export function usePerformanceSeries() {
  return useQuery<PerformanceSeries>({
    queryKey: ['portfolio-performance'],
    queryFn: async () => {
      const res = await fetch('/api/portfolio/performance')
      if (!res.ok) throw new Error('Failed to load performance series')
      return res.json() as Promise<PerformanceSeries>
    },
  })
}
