'use client'

import { useQuery } from '@tanstack/react-query'
import type { NewsItem } from '@/lib/news/types'

/** General financial news from /api/news (server-cached ~30 min). */
export function useGeneralNews() {
  return useQuery<NewsItem[]>({
    queryKey: ['news', 'general'],
    queryFn: async () => {
      const res = await fetch('/api/news')
      if (!res.ok) throw new Error('Failed to load news')
      return res.json() as Promise<NewsItem[]>
    },
    staleTime: 15 * 60_000,
  })
}
