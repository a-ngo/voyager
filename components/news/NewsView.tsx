'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/utils/format'
import { useGeneralNews } from '@/hooks/useNews'
import type { NewsItem } from '@/lib/news/types'

type Tab = 'general' | 'foryou'

export function NewsView() {
  const [tab, setTab] = useState<Tab>('general')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-border">
        <TabButton active={tab === 'general'} onClick={() => setTab('general')}>
          General
        </TabButton>
        <TabButton active={tab === 'foryou'} onClick={() => setTab('foryou')}>
          For You
        </TabButton>
      </div>

      {tab === 'general' ? <GeneralFeed /> : <ForYouPlaceholder />}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm ${
        active
          ? 'border-brand font-medium text-foreground'
          : 'border-transparent text-muted hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

function GeneralFeed() {
  const { data, isLoading, isError } = useGeneralNews()

  if (isLoading)
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted">Loading news…</CardContent>
      </Card>
    )
  if (isError)
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-negative">
          Couldn’t load news. Try again shortly.
        </CardContent>
      </Card>
    )
  if (!data || data.length === 0)
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted">
          No news available right now.
        </CardContent>
      </Card>
    )

  return (
    <Card>
      <CardContent className="flex flex-col divide-y divide-border/60 pt-2">
        {data.map((item) => (
          <NewsRow key={item.url} item={item} />
        ))}
      </CardContent>
    </Card>
  )
}

function NewsRow({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-1 py-3"
    >
      <span className="text-sm text-foreground group-hover:text-brand">{item.title}</span>
      <span className="text-xs text-faint">
        {item.source}
        {item.publishedAt ? ` · ${formatDate(item.publishedAt)}` : ''}
      </span>
      {item.summary && <span className="line-clamp-2 text-xs text-muted">{item.summary}</span>}
    </a>
  )
}

function ForYouPlaceholder() {
  return (
    <Card>
      <CardContent className="py-12 text-center text-sm text-muted">
        <p className="font-medium text-foreground">Coming soon</p>
        <p className="mt-1">
          A personalized feed: news ranked to your holdings, sectors, and the macro topics that move
          your portfolio — filtered by your selected AI model.
        </p>
      </CardContent>
    </Card>
  )
}
