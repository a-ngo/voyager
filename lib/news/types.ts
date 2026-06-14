export interface NewsItem {
  title: string
  url: string
  source: string
  /** ISO timestamp, or null if the feed omitted/garbled the date. */
  publishedAt: string | null
  summary: string | null
}
