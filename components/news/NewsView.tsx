'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/utils/format'
import { useGeneralNews, usePersonalNews } from '@/hooks/useNews'
import { MODEL_OPTIONS, DEFAULT_MODEL_ID, type ModelId } from '@/lib/ai/models'
import type { NewsItem, RankedNewsItem } from '@/lib/news/types'

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

      {tab === 'general' ? <GeneralFeed /> : <ForYouFeed active={tab === 'foryou'} />}
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

function StateCard({ tone, children }: { tone: 'muted' | 'negative'; children: React.ReactNode }) {
  // Literal class strings — Tailwind's scanner can't see interpolated names.
  const cls = tone === 'negative' ? 'text-negative' : 'text-muted'
  return (
    <Card>
      <CardContent className={`py-12 text-center text-sm ${cls}`}>{children}</CardContent>
    </Card>
  )
}

function GeneralFeed() {
  const { data, isLoading, isError } = useGeneralNews()

  if (isLoading) return <StateCard tone="muted">Loading news…</StateCard>
  if (isError) return <StateCard tone="negative">Couldn’t load news. Try again shortly.</StateCard>
  if (!data || data.length === 0) return <StateCard tone="muted">No news available right now.</StateCard>

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

function ForYouFeed({ active }: { active: boolean }) {
  const [modelId, setModelId] = useState<ModelId>(DEFAULT_MODEL_ID)
  const { data, isLoading, isError } = usePersonalNews(modelId, active)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <label htmlFor="news-model" className="text-xs text-muted">
          Rank with
        </label>
        <select
          id="news-model"
          value={modelId}
          onChange={(e) => setModelId(e.target.value as ModelId)}
          className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
        >
          {MODEL_OPTIONS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <StateCard tone="muted">Building your feed…</StateCard>}
      {isError && <StateCard tone="negative">Couldn’t load your feed. Try again shortly.</StateCard>}
      {data && (
        <>
          {data.note && (
            <p className="rounded-md border border-border bg-panel px-3 py-2 text-xs text-muted">
              {data.note}
            </p>
          )}
          {data.items.length === 0 ? (
            <StateCard tone="muted">Nothing relevant right now — check back later.</StateCard>
          ) : (
            <Card>
              <CardContent className="flex flex-col divide-y divide-border/60 pt-2">
                {data.items.map((item) => (
                  <RankedRow key={item.url} item={item} />
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function Meta({ item }: { item: NewsItem }) {
  return (
    <span className="text-xs text-faint">
      {item.source}
      {item.publishedAt ? ` · ${formatDate(item.publishedAt)}` : ''}
    </span>
  )
}

function NewsRow({ item }: { item: NewsItem }) {
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="group flex flex-col gap-1 py-3">
      <span className="text-sm text-foreground group-hover:text-brand">{item.title}</span>
      <Meta item={item} />
      {item.summary && <span className="line-clamp-2 text-xs text-muted">{item.summary}</span>}
    </a>
  )
}

const RELEVANCE_DOT = { high: 'bg-brand', medium: 'bg-info', low: 'bg-faint' } as const

function RankedRow({ item }: { item: RankedNewsItem }) {
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="group flex flex-col gap-1 py-3">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${RELEVANCE_DOT[item.relevance]}`} />
        <span className="rounded bg-panel-elevated px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
          {item.relatedTo}
        </span>
        <span className="text-sm text-foreground group-hover:text-brand">{item.title}</span>
      </div>
      {item.why && <span className="pl-3.5 text-xs text-muted">{item.why}</span>}
      <span className="pl-3.5">
        <Meta item={item} />
      </span>
    </a>
  )
}
