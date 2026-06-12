'use client'

import { useQuery } from '@tanstack/react-query'
import type { XrayData } from '@/lib/portfolio/xray'

/** Look-through portfolio X-Ray, from /api/portfolio/xray. Slow (many lookups). */
export function useXray() {
  return useQuery<XrayData>({
    queryKey: ['portfolio-xray'],
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const res = await fetch('/api/portfolio/xray')
      if (!res.ok) throw new Error('Failed to load X-Ray')
      return res.json() as Promise<XrayData>
    },
  })
}
