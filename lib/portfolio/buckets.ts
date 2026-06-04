import type { AssetClass } from '@/lib/import/types'

/** Allocation bucket = asset class, plus an "other" catch-all for unclassified holdings. */
export type Bucket = AssetClass | 'other'

/** Buckets a user can set a target for (excludes the "other" catch-all). */
export const EDITABLE_BUCKETS: AssetClass[] = ['stock', 'etf', 'bond', 'crypto', 'cash']

export const BUCKET_LABEL: Record<Bucket, string> = {
  stock: 'Stocks',
  etf: 'ETFs',
  bond: 'Bonds',
  crypto: 'Crypto',
  cash: 'Cash',
  other: 'Other',
}

export const BUCKET_COLOR: Record<Bucket, string> = {
  stock: '#c2613f',
  etf: '#6f94a6',
  bond: '#d2a052',
  crypto: '#9479b0',
  cash: '#a79e8e',
  other: '#7e9e78',
}
