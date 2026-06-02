/**
 * Allocation drift vs. target (CLAUDE.md §3.4).
 * Pure function: plain data in, typed result out. No formatting, no DB, no fetch.
 */

export interface AllocationDrift {
  key: string
  current: number // current weight, 0..1
  target: number // target weight, 0..1
  drift: number // current - target (signed)
  absDrift: number // |drift|
  breached: boolean // absDrift > threshold
}

export interface DriftReport {
  items: AllocationDrift[]
  maxAbsDrift: number
  anyBreached: boolean
}

/**
 * Compare current weights to target weights.
 * @param current  map of asset key → current weight (0..1)
 * @param target   map of asset key → target weight (0..1)
 * @param threshold absolute drift that counts as a breach (e.g. 0.05 = 5pp)
 */
export function computeDrift(
  current: Record<string, number>,
  target: Record<string, number>,
  threshold: number,
): DriftReport {
  const keys = new Set([...Object.keys(current), ...Object.keys(target)])
  const items: AllocationDrift[] = []

  for (const key of keys) {
    const c = current[key] ?? 0
    const t = target[key] ?? 0
    const drift = c - t
    const absDrift = Math.abs(drift)
    items.push({
      key,
      current: c,
      target: t,
      drift,
      absDrift,
      breached: absDrift > threshold,
    })
  }

  items.sort((a, b) => b.absDrift - a.absDrift)

  const maxAbsDrift = items.reduce((max, item) => Math.max(max, item.absDrift), 0)

  return {
    items,
    maxAbsDrift,
    anyBreached: items.some((item) => item.breached),
  }
}
