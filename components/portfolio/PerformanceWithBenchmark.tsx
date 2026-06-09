'use client'

import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { PerformanceChart, type BenchmarkLine } from '@/components/charts/PerformanceChart'
import { BENCHMARKS } from '@/lib/finance/benchmark'
import type { BenchmarkSeries } from '@/lib/portfolio/benchmark-series'
import type { PerfPoint } from '@/lib/finance/performance'

/**
 * Performance chart with "alternative reality" benchmark overlays. The portfolio
 * line is server-rendered (passed in); any number of benchmarks can be toggled
 * on, each fetched independently and overlaid without refetching the portfolio.
 */
export function PerformanceWithBenchmark({
  points,
  currency,
}: {
  points: PerfPoint[]
  currency: string
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Stable order (registry order) so query slots and colours stay consistent.
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

  // Merge each loaded benchmark's value into the portfolio points by date.
  const dateMaps = [...seriesById].map(
    ([id, s]) => [id, new Map(s.points.map((p) => [p.date, p.benchmark]))] as const,
  )
  const merged = points.map((p) => {
    const row: PerfPoint & Partial<Record<`bench_${string}`, number>> = { ...p }
    for (const [id, m] of dateMaps) row[`bench_${id}`] = m.get(p.date)
    return row
  })

  const benchmarkLines: BenchmarkLine[] = BENCHMARKS.filter((b) => seriesById.has(b.id)).map((b) => ({
    key: `bench_${b.id}`,
    label: b.label,
    color: b.color,
  }))

  const anyLoading = results.some((r) => r.isFetching)
  const anyError = results.some((r) => r.isError)

  function toggle(id: string) {
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
              onClick={() => toggle(b.id)}
              title={b.description}
              aria-pressed={on}
              className={
                on
                  ? 'flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs'
                  : 'flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted hover:text-foreground'
              }
              style={on ? { borderColor: b.color, color: b.color } : undefined}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: on ? b.color : 'currentColor', opacity: on ? 1 : 0.4 }} />
              {b.label}
            </button>
          )
        })}
        {anyLoading && <span className="text-xs text-faint">loading…</span>}
        {anyError && <span className="text-xs text-negative">a benchmark failed to load</span>}
      </div>

      <div className="h-80">
        <PerformanceChart points={merged} currency={currency} benchmarks={benchmarkLines} />
      </div>
    </div>
  )
}
