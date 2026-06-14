'use client'

import { useQuery } from '@tanstack/react-query'
import type { NewsItem, PersonalNews } from '@/lib/news/types'

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

/** Personalized "For You" feed, ranked by the chosen model. */
export function usePersonalNews(modelId: string, enabled: boolean) {
  return useQuery<PersonalNews>({
    queryKey: ['news', 'personal', modelId],
    enabled,
    queryFn: async () => {
      const res = await fetch(`/api/news/personal?model=${encodeURIComponent(modelId)}`)
      if (!res.ok) throw new Error('Failed to load personalized news')
      return res.json() as Promise<PersonalNews>
    },
    staleTime: 15 * 60_000,
  })
}
