'use client'

import { useQuery } from '@tanstack/react-query'
import type { InstrumentDetail } from '@/lib/prices/yahoo-fundamentals'

/** Fundamentals + analyst detail for one Yahoo symbol, fetched when set. */
export function useInstrumentDetail(symbol: string | null) {
  return useQuery<InstrumentDetail>({
    queryKey: ['instrument', symbol],
    enabled: !!symbol,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const res = await fetch(`/api/instrument?symbol=${encodeURIComponent(symbol!)}`)
      if (!res.ok) throw new Error('Failed to load instrument')
      return res.json() as Promise<InstrumentDetail>
    },
  })
}
