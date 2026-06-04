import { BUCKET_COLOR, BUCKET_LABEL, type Bucket } from './buckets'

/** A current-vs-target row for one allocation bucket. */
export interface TargetRow {
  bucket: Bucket
  label: string
  color: string
  current: number // current weight, %
  target: number // target weight, %
  drift: number // current − target, percentage points
}

interface CurrentSlice {
  bucket: Bucket
  weight: number
  color: string
}

const ORDER: Bucket[] = ['stock', 'etf', 'bond', 'crypto', 'cash', 'other']

/**
 * Merge current allocation with target weights into per-bucket comparison rows.
 * Pure — buckets with neither a holding nor a target are omitted.
 */
export function buildTargetComparison(
  current: CurrentSlice[],
  targets: Record<string, number>,
): TargetRow[] {
  const currentByBucket = new Map(current.map((s) => [s.bucket, s]))

  return ORDER.flatMap((bucket) => {
    const slice = currentByBucket.get(bucket)
    const currentWeight = slice?.weight ?? 0
    const target = targets[bucket] ?? 0
    if (currentWeight === 0 && target === 0) return []
    return [
      {
        bucket,
        label: BUCKET_LABEL[bucket],
        color: slice?.color ?? BUCKET_COLOR[bucket],
        current: currentWeight,
        target,
        drift: currentWeight - target,
      },
    ]
  })
}
