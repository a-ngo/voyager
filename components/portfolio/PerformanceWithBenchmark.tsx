'use client'

import { useEffect, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { PerformanceChart, type BenchmarkLine } from '@/components/charts/PerformanceChart'
import { BENCHMARKS } from '@/lib/finance/benchmark'
import type { BenchmarkSeries } from '@/lib/portfolio/benchmark-series'
import type { TradedPerfPoint } from '@/lib/portfolio/performance-series'
import type { PerfPoint } from '@/lib/finance/performance'

type TimeWindow = 'ytd' | '1y' | '3y' | 'all'
const WINDOWS: { id: TimeWindow; label: string }[] = [
  { id: 'ytd', label: 'YTD' },
  { id: '1y', label: '1Y' },
  { id: '3y', label: '3Y' },
  { id: 'all', label: 'All' },
]

const STORAGE_KEY = 'voyager.performance.view'

interface ViewState {
  benchmarks: string[]
  window: TimeWindow
  trades: boolean
}

/** Earliest date to show for a window, or null for all-time. */
function windowCutoff(w: TimeWindow): string | null {
  if (w === 'all') return null
  const now = new Date()
  if (w === 'ytd') return `${now.getUTCFullYear()}-01-01`
  const d = new Date(now)
  d.setUTCFullYear(d.getUTCFullYear() - (w === '1y' ? 1 : 3))
  return d.toISOString().slice(0, 10)
}

type ChartRow = PerfPoint & { buyMarker?: number; sellMarker?: number } & Partial<
    Record<`bench_${string}`, number>
  >

/**
 * Performance chart with alternative-reality benchmark overlays, a time-window
 * selector, and an optional buy/sell marker layer. The portfolio line is
 * server-rendered (passed in); benchmarks are fetched on demand. The whole view
 * (selected benchmarks, window, trade markers) persists across navigation.
 */
export function PerformanceWithBenchmark({
  points,
  currency,
}: {
  points: TradedPerfPoint[]
  currency: string
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('all')
  const [showTrades, setShowTrades] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const v = JSON.parse(raw) as Partial<ViewState>
        if (Array.isArray(v.benchmarks)) {
          setSelected(new Set(v.benchmarks.filter((id) => BENCHMARKS.some((b) => b.id === id))))
        }
        if (v.window && WINDOWS.some((w) => w.id === v.window)) setTimeWindow(v.window)
        if (typeof v.trades === 'boolean') setShowTrades(v.trades)
      }
    } catch {
      // Corrupt state — start with defaults.
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const v: ViewState = { benchmarks: [...selected], window: timeWindow, trades: showTrades }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
  }, [selected, timeWindow, showTrades, hydrated])

  const selectedIds = BENCHMARKS.filter((b) => selected.has(b.id)).map((b) => b.id)

  const results = useQueries({
    queries: selectedIds.map((id) => ({
      queryKey: ['portfolio-benchmark', id],
      staleTime: 5 * 60 * 1000,
      queryFn: async (): Promise<BenchmarkSeries> => {
        const res = await fetch(`/api/portfolio/benchmark?id=${encodeURIComponent(id)}`)
        if (!res.ok) throw new Error('Failed to load benchmark')
        return res.json() as Promise<BenchmarkSeries>
      },
    })),
  })

  const seriesById = new Map<string, BenchmarkSeries>()
  selectedIds.forEach((id, i) => {
    const data = results[i]?.data
    if (data) seriesById.set(id, data)
  })

  const cutoff = windowCutoff(timeWindow)
  const windowed = cutoff ? points.filter((p) => p.date >= cutoff) : points

  const dateMaps = [...seriesById].map(
    ([id, s]) => [id, new Map(s.points.map((p) => [p.date, p.benchmark]))] as const,
  )

  const merged: ChartRow[] = windowed.map((p) => {
    const row: ChartRow = { date: p.date, value: p.value, invested: p.invested }
    for (const [id, m] of dateMaps) row[`bench_${id}`] = m.get(p.date)
    if (showTrades) {
      if (p.buys > 0) row.buyMarker = p.value
      if (p.sells > 0) row.sellMarker = p.value
    }
    return row
  })

  const benchmarkLines: BenchmarkLine[] = BENCHMARKS.filter((b) => seriesById.has(b.id)).map((b) => ({
    key: `bench_${b.id}`,
    label: b.label,
    color: b.color,
  }))

  const anyLoading = results.some((r) => r.isFetching)
  const anyError = results.some((r) => r.isError)

  function toggleBenchmark(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-faint">Compare with:</span>
        {BENCHMARKS.map((b) => {
          const on = selected.has(b.id)
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => toggleBenchmark(b.id)}
              title={b.description}
              aria-pressed={on}
              className="flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs hover:text-foreground"
              style={
                on
                  ? { borderColor: b.color, color: b.color }
                  : { borderColor: 'var(--color-border)', color: 'var(--color-muted)' }
              }
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: b.color, opacity: on ? 1 : 0.4 }}
              />
              {b.label}
            </button>
          )
        })}
        {anyLoading && <span className="text-xs text-faint">loading…</span>}
        {anyError && <span className="text-xs text-negative">a benchmark failed to load</span>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
          {WINDOWS.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setTimeWindow(w.id)}
              aria-pressed={timeWindow === w.id}
              className={
                timeWindow === w.id
                  ? 'rounded-full bg-brand/10 px-2.5 py-0.5 text-xs text-brand'
                  : 'rounded-full px-2.5 py-0.5 text-xs text-muted hover:text-foreground'
              }
            >
              {w.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowTrades((s) => !s)}
          aria-pressed={showTrades}
          className={
            showTrades
              ? 'rounded-full border border-brand bg-brand/10 px-2.5 py-0.5 text-xs text-brand'
              : 'rounded-full border border-border px-2.5 py-0.5 text-xs text-muted hover:text-foreground'
          }
        >
          {showTrades ? '● ' : '○ '}Buy / sell markers
        </button>
      </div>

      <div className="h-80">
        <PerformanceChart
          points={merged}
          currency={currency}
          benchmarks={benchmarkLines}
          showTrades={showTrades}
        />
      </div>
    </div>
  )
}
