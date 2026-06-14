export interface NewsItem {
  title: string
  url: string
  source: string
  /** ISO timestamp, or null if the feed omitted/garbled the date. */
  publishedAt: string | null
  summary: string | null
}

export type NewsBucket = 'holding' | 'sector' | 'macro'
export type Relevance = 'high' | 'medium' | 'low'

/** A news item tagged with what it relates to and (optionally) why it matters. */
export interface RankedNewsItem extends NewsItem {
  bucket: NewsBucket
  /** What produced it: a holding name, a sector, or "Macro". */
  relatedTo: string
  relevance: Relevance
  /** One-line "why it matters", set by the model; null in the recency fallback. */
  why: string | null
}

export interface PersonalNews {
  items: RankedNewsItem[]
  /** True when an AI model ranked the feed; false when it fell back to recency. */
  ranked: boolean
  /** User-facing note, e.g. why ranking was skipped. */
  note: string | null
}
