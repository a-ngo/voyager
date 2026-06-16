/**
 * Custom clusters: group instruments (open and past) into user-defined buckets
 * (e.g. core vs. satellite) and aggregate their performance. Pure — the
 * cluster definitions and per-instrument assignments are supplied by the caller
 * (persisted client-side); this only sums and computes returns.
 */

export interface ClusterDef {
  id: string
  name: string
  color: string
}

/** The per-instrument figures a cluster aggregates. `key` matches the assignment map. */
export interface ClusterInstrument {
  key: string
  marketValue: number | null
  costBasis: number
  unrealizedPnl: number | null
  realizedPnl: number
  income: number
  invested: number
}

export interface ClusterPerformance {
  id: string
  name: string
  color: string
  count: number
  marketValue: number
  costBasis: number
  unrealizedPnl: number
  realizedPnl: number
  income: number
  invested: number
  /** unrealizedPnl + realizedPnl + income. */
  totalPnl: number
  /** totalPnl / invested as a percentage; null when nothing was invested. */
  returnPct: number | null
  keys: string[]
}

const UNASSIGNED_ID = '__unassigned__'

function emptyPerf(id: string, name: string, color: string): ClusterPerformance {
  return {
    id,
    name,
    color,
    count: 0,
    marketValue: 0,
    costBasis: 0,
    unrealizedPnl: 0,
    realizedPnl: 0,
    income: 0,
    invested: 0,
    totalPnl: 0,
    returnPct: null,
    keys: [],
  }
}

function add(perf: ClusterPerformance, inst: ClusterInstrument): void {
  perf.count += 1
  perf.marketValue += inst.marketValue ?? 0
  perf.costBasis += inst.costBasis
  perf.unrealizedPnl += inst.unrealizedPnl ?? 0
  perf.realizedPnl += inst.realizedPnl
  perf.income += inst.income
  perf.invested += inst.invested
  perf.keys.push(inst.key)
}

function finalize(perf: ClusterPerformance): void {
  perf.totalPnl = perf.unrealizedPnl + perf.realizedPnl + perf.income
  perf.returnPct = perf.invested > 0 ? (perf.totalPnl / perf.invested) * 100 : null
}

/**
 * Aggregate instruments into their assigned clusters. Instruments with no (or an
 * unknown) assignment fall into a synthetic "Unassigned" bucket, returned
 * separately. Cluster order follows `clusters`.
 */
export function clusterPerformance(
  clusters: ClusterDef[],
  assignments: Record<string, string>,
  instruments: ClusterInstrument[],
): { clusters: ClusterPerformance[]; unassigned: ClusterPerformance } {
  const byId = new Map<string, ClusterPerformance>()
  for (const c of clusters) byId.set(c.id, emptyPerf(c.id, c.name, c.color))
  const unassigned = emptyPerf(UNASSIGNED_ID, 'Unassigned', '#8a8a8a')

  for (const inst of instruments) {
    const target = byId.get(assignments[inst.key] ?? '') ?? unassigned
    add(target, inst)
  }

  const result = clusters.map((c) => byId.get(c.id)!)
  for (const p of result) finalize(p)
  finalize(unassigned)

  return { clusters: result, unassigned }
}

export { UNASSIGNED_ID }
