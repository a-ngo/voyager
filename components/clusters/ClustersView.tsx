'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { GripVertical, Plus, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Money } from '@/components/shared/Money'
import { clusterPerformance, type ClusterDef, type ClusterPerformance } from '@/lib/finance/clusters'
import type { InstrumentBreakdownItem } from '@/lib/portfolio/instruments'

const ClusterValueChart = dynamic(
  () => import('./ClusterValueChart').then((m) => m.ClusterValueChart),
  { ssr: false },
)

const STORAGE_KEY = 'voyager:clusters'
const PALETTE = [
  '#5b9bff',
  '#56c98a',
  '#e0a458',
  '#b58bd6',
  '#e5687a',
  '#3fb6b0',
  '#d98f5a',
  '#7c9cbf',
]

interface ClusterState {
  clusters: ClusterDef[]
  assignments: Record<string, string>
}

function defaultState(): ClusterState {
  return {
    clusters: [
      { id: 'core', name: 'Core', color: PALETTE[0]! },
      { id: 'satellite', name: 'Satellite', color: PALETTE[1]! },
    ],
    assignments: {},
  }
}

const pnlClass = (v: number) => (v > 0 ? 'text-positive' : v < 0 ? 'text-negative' : 'text-muted')
const pctText = (f: number | null) => (f == null ? '—' : `${f >= 0 ? '+' : ''}${f.toFixed(1)}%`)

export function ClustersView({
  instruments,
  dates,
  currency,
}: {
  instruments: InstrumentBreakdownItem[]
  dates: string[]
  currency: string
}) {
  const [clusters, setClusters] = useState<ClusterDef[]>([])
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [hydrated, setHydrated] = useState(false)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const v = raw ? (JSON.parse(raw) as Partial<ClusterState>) : null
      const d = defaultState()
      setClusters(Array.isArray(v?.clusters) && v.clusters.length > 0 ? v.clusters : d.clusters)
      setAssignments(v?.assignments && typeof v.assignments === 'object' ? v.assignments : {})
    } catch {
      const d = defaultState()
      setClusters(d.clusters)
      setAssignments(d.assignments)
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ clusters, assignments }))
  }, [hydrated, clusters, assignments])

  const byKey = useMemo(() => new Map(instruments.map((i) => [i.key, i])), [instruments])
  const seriesByKey = useMemo(
    () => new Map(instruments.map((i) => [i.key, i.valueSeries])),
    [instruments],
  )

  const perf = useMemo(
    () =>
      clusterPerformance(
        clusters,
        assignments,
        instruments.map((i) => ({
          key: i.key,
          marketValue: i.marketValue,
          costBasis: i.costBasis,
          unrealizedPnl: i.unrealizedPnl,
          realizedPnl: i.realizedPnl,
          income: i.income,
          invested: i.invested,
        })),
      ),
    [clusters, assignments, instruments],
  )

  const { chartData, chartLines } = useMemo(() => {
    const cols = [
      ...perf.clusters.map((p, i) => ({
        id: clusters[i]!.id,
        name: clusters[i]!.name,
        color: clusters[i]!.color,
        keys: p.keys,
      })),
      { id: 'unassigned', name: 'Unassigned', color: '#8a8a8a', keys: perf.unassigned.keys },
    ]
    const data = dates.map((date, di) => {
      const row: Record<string, number | string> = { date }
      for (const c of cols) {
        row[c.id] = c.keys.reduce((sum, k) => sum + (seriesByKey.get(k)?.[di] ?? 0), 0)
      }
      return row
    })
    // Always show cluster lines; show Unassigned only while it holds value.
    const lines = cols
      .filter((c) => c.id !== 'unassigned' || data.some((r) => (r[c.id] as number) > 0.5))
      .map(({ id, name, color }) => ({ id, name, color }))
    return { chartData: data, chartLines: lines }
  }, [perf, clusters, dates, seriesByKey])

  function assign(key: string, clusterId: string | null) {
    setAssignments((prev) => {
      const next = { ...prev }
      if (clusterId == null) delete next[key]
      else next[key] = clusterId
      return next
    })
  }
  function addCluster() {
    setClusters((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: `Cluster ${prev.length + 1}`,
        color: PALETTE[prev.length % PALETTE.length]!,
      },
    ])
  }
  function renameCluster(id: string, name: string) {
    setClusters((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)))
  }
  function cycleColor(id: string) {
    setClusters((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, color: PALETTE[(PALETTE.indexOf(c.color) + 1) % PALETTE.length]! } : c,
      ),
    )
  }
  function removeCluster(id: string) {
    setClusters((prev) => prev.filter((c) => c.id !== id))
    setAssignments((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([, v]) => v !== id)),
    )
  }
  function handleDrop(clusterId: string | null) {
    if (dragKey) assign(dragKey, clusterId)
    setDragKey(null)
    setOverId(null)
  }

  if (!hydrated) return null

  const columns: { id: string; def: ClusterDef | null; perf: ClusterPerformance }[] = [
    ...perf.clusters.map((p, i) => ({ id: clusters[i]!.id, def: clusters[i]!, perf: p })),
    { id: 'unassigned', def: null, perf: perf.unassigned },
  ]
  const comparisonRows = columns.filter((c) => c.def != null || c.perf.count > 0)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cluster comparison</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-faint">
                <th className="px-1 py-1 font-medium">Cluster</th>
                <th className="px-1 py-1 text-right font-medium">Holdings</th>
                <th className="px-1 py-1 text-right font-medium">Value</th>
                <th className="px-1 py-1 text-right font-medium">Invested</th>
                <th className="px-1 py-1 text-right font-medium">Realized</th>
                <th className="px-1 py-1 text-right font-medium">Unrealized</th>
                <th className="px-1 py-1 text-right font-medium">Income</th>
                <th className="px-1 py-1 text-right font-medium">Total P/L</th>
                <th className="px-1 py-1 text-right font-medium">Return</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map(({ id, def, perf: p }) => (
                <tr key={id} className="border-t border-border/50">
                  <td className="px-1 py-1.5">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: def?.color ?? '#8a8a8a' }}
                      />
                      <span className="text-foreground">{def?.name ?? 'Unassigned'}</span>
                    </span>
                  </td>
                  <td className="px-1 py-1.5 text-right tabular-nums text-muted">{p.count}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums">
                    <Money value={p.marketValue} currency={currency} />
                  </td>
                  <td className="px-1 py-1.5 text-right tabular-nums text-muted">
                    <Money value={p.invested} currency={currency} />
                  </td>
                  <td className={`px-1 py-1.5 text-right tabular-nums ${pnlClass(p.realizedPnl)}`}>
                    <Money value={p.realizedPnl} currency={currency} />
                  </td>
                  <td className={`px-1 py-1.5 text-right tabular-nums ${pnlClass(p.unrealizedPnl)}`}>
                    <Money value={p.unrealizedPnl} currency={currency} />
                  </td>
                  <td className="px-1 py-1.5 text-right tabular-nums text-muted">
                    <Money value={p.income} currency={currency} />
                  </td>
                  <td className={`px-1 py-1.5 text-right tabular-nums ${pnlClass(p.totalPnl)}`}>
                    <Money value={p.totalPnl} currency={currency} />
                  </td>
                  <td className={`px-1 py-1.5 text-right tabular-nums ${pnlClass(p.returnPct ?? 0)}`}>
                    {pctText(p.returnPct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {dates.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Cluster value over time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ClusterValueChart data={chartData} lines={chartLines} currency={currency} />
            </div>
            <p className="mt-2 text-xs text-faint">
              Market value of each cluster’s holdings at each month-end. Updates as you reassign
              holdings. A position drops to zero once fully sold.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map(({ id, def, perf: p }) => (
          <div
            key={id}
            onDragOver={(e) => {
              e.preventDefault()
              setOverId(id)
            }}
            onDragLeave={() => setOverId((o) => (o === id ? null : o))}
            onDrop={() => handleDrop(def?.id ?? null)}
            className={`flex w-64 shrink-0 flex-col rounded-lg border bg-panel ${
              overId === id ? 'border-brand' : 'border-border'
            }`}
          >
            <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-2">
              {def ? (
                <>
                  <button
                    type="button"
                    onClick={() => cycleColor(def.id)}
                    aria-label="Change colour"
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: def.color }}
                  />
                  <input
                    value={def.name}
                    onChange={(e) => renameCluster(def.id, e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeCluster(def.id)}
                    aria-label="Remove cluster"
                    className="text-faint hover:text-negative"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <span className="flex-1 text-sm font-medium text-muted">Unassigned</span>
              )}
            </div>

            <div className="flex items-baseline justify-between px-2.5 py-1.5 text-xs">
              <span className={`font-semibold tabular-nums ${pnlClass(p.totalPnl)}`}>
                <Money value={p.totalPnl} currency={currency} />
              </span>
              <span className={`tabular-nums ${pnlClass(p.returnPct ?? 0)}`}>
                {pctText(p.returnPct)}
              </span>
            </div>

            <div className="flex min-h-24 flex-1 flex-col gap-1 p-2">
              {p.keys.length === 0 ? (
                <p className="px-1 py-3 text-center text-xs text-faint">Drag holdings here</p>
              ) : (
                p.keys.map((key) => {
                  const inst = byKey.get(key)
                  if (!inst) return null
                  const total = (inst.unrealizedPnl ?? 0) + inst.realizedPnl + inst.income
                  return (
                    <div
                      key={key}
                      draggable
                      onDragStart={(e) => {
                        setDragKey(key)
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', key)
                      }}
                      onDragEnd={() => setDragKey(null)}
                      className={`flex cursor-grab items-center gap-1.5 rounded-md border border-border bg-panel-elevated px-2 py-1.5 text-xs active:cursor-grabbing ${
                        dragKey === key ? 'opacity-40' : ''
                      }`}
                    >
                      <GripVertical className="h-3 w-3 shrink-0 text-faint" />
                      <span className="min-w-0 flex-1 truncate text-foreground" title={inst.name}>
                        {inst.name}
                      </span>
                      <span className={`shrink-0 tabular-nums ${pnlClass(total)}`}>
                        <Money value={total} currency={currency} />
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addCluster}
          className="flex w-44 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-sm text-muted hover:border-brand hover:text-brand"
        >
          <Plus className="h-4 w-4" /> Add cluster
        </button>
      </div>

      <p className="text-xs text-faint">
        Saved on this device. Drag a holding into a cluster to categorize it; closed positions count
        toward realized P/L. Return is total P/L (realized + unrealized + income) over the capital
        invested in the cluster. Click a cluster’s dot to recolor, the name to rename, the × to
        remove (its holdings return to Unassigned).
      </p>
    </div>
  )
}
