'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatMoney } from '@/lib/utils/format'
import { usePortfolioSummary } from '@/hooks/usePortfolioSummary'
import { usePerformanceSeries } from '@/hooks/usePerformanceSeries'
import { project, yearsToReach } from '@/lib/finance/projection'
import { timeWeightedReturn } from '@/lib/finance/returns'
import type { ScenarioLine, TargetMarker } from './ProjectionChart'

const ProjectionChart = dynamic(
  () => import('./ProjectionChart').then((m) => m.ProjectionChart),
  { ssr: false },
)

const SCENARIO_META = [
  { id: 'cash', label: 'Cash interest', color: '#5b9bff' },
  { id: 'historical', label: 'Historical return', color: '#f0a35a' },
  { id: 'custom', label: 'Custom', color: '#56c98a' },
] as const satisfies ScenarioLine[]

/** Round to a clean 1 / 2 / 5 × 10ⁿ value (for the default target only). */
function niceRound(n: number): number {
  if (n <= 0) return 0
  const e = Math.pow(10, Math.floor(Math.log10(n)))
  const f = n / e
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * e
}

function num(e: React.ChangeEvent<HTMLInputElement>): number {
  const n = Number(e.target.value)
  return Number.isFinite(n) ? n : 0
}

export function ProjectionsView() {
  const { data: summary } = usePortfolioSummary()
  const { data: perf, isLoading: perfLoading } = usePerformanceSeries()

  // Every field is independent plain state; the data-derived ones are seeded once
  // (below) and never recompute from other inputs.
  const [initial, setInitial] = useState(0)
  const [monthly, setMonthly] = useState(500)
  const [years, setYears] = useState(20)
  const [cashRate, setCashRate] = useState(2.25)
  const [histRate, setHistRate] = useState(7)
  const [customRate, setCustomRate] = useState(8)
  const [target, setTarget] = useState(0)

  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current || !summary || perfLoading) return
    const nw = Math.round(summary.netWorth ?? 0)
    // Prefill historical return with the all-time (since-start) annualized TWR —
    // the same figure the Performance page shows for the "All" window.
    const twr = perf?.points ? timeWeightedReturn(perf.points) : null
    const hist = twr ? Math.round(twr.annualized * 1000) / 10 : 7
    const proj = project({ initial: nw, monthlyContribution: 500, annualRatePct: hist, years: 20 })
    setInitial(nw)
    setHistRate(hist)
    setTarget(niceRound(proj.points[Math.round(20 * 0.75)]?.value ?? proj.finalValue))
    seeded.current = true
  }, [summary, perf, perfLoading])

  const rates: Record<string, number> = { cash: cashRate, historical: histRate, custom: customRate }

  const computed = useMemo(
    () =>
      SCENARIO_META.map((s) => {
        const annualRatePct = rates[s.id] ?? 0
        return {
          meta: s,
          annualRatePct,
          res: project({ initial, monthlyContribution: monthly, annualRatePct, years }),
          cross: yearsToReach({ initial, monthlyContribution: monthly, annualRatePct, target }),
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initial, monthly, years, cashRate, histRate, customRate, target],
  )

  const chartData = useMemo(() => {
    const rows: Record<string, number>[] = []
    for (let y = 0; y <= years; y++) {
      const row: Record<string, number> = { year: y }
      for (const { meta, res } of computed) row[meta.id] = res.points[y]?.value ?? res.finalValue
      row.invested = computed[0]?.res.points[y]?.invested ?? initial
      rows.push(row)
    }
    return rows
  }, [computed, years, initial])

  const markers: TargetMarker[] = computed
    .filter((c) => c.cross != null && c.cross <= years)
    .map((c) => ({ id: c.meta.id, color: c.meta.color, year: c.cross as number }))

  const totalInvested = initial + monthly * years * 12

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-6 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Starting value" value={initial} onChange={(e) => setInitial(num(e))} suffix="€" />
          <Field label="Monthly saving" value={monthly} onChange={(e) => setMonthly(num(e))} suffix="€" />
          <Field label="Years" value={years} onChange={(e) => setYears(Math.max(1, Math.min(60, num(e))))} />
          <Field label="Target value" value={target} onChange={(e) => setTarget(num(e))} suffix="€" />
          <Field label="Cash interest" value={cashRate} onChange={(e) => setCashRate(num(e))} suffix="%" step="0.05" />
          <Field label="Historical return" value={histRate} onChange={(e) => setHistRate(num(e))} suffix="%" step="0.1" />
          <Field label="Custom return" value={customRate} onChange={(e) => setCustomRate(num(e))} suffix="%" step="0.1" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Projected value over {years} years</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ProjectionChart
              data={chartData}
              scenarios={[...SCENARIO_META]}
              currency="EUR"
              target={target}
              markers={markers}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {computed.map(({ meta, annualRatePct, res, cross }) => (
          <Card key={meta.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} />
                {meta.label} · {annualRatePct.toFixed(2)}%
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <span className="text-2xl font-medium text-foreground">
                {formatMoney(res.finalValue, 'EUR')}
              </span>
              <span className="text-xs text-muted">
                {formatMoney(res.totalGrowth, 'EUR')} from compounding
              </span>
              <span className="text-xs text-faint">
                {target <= 0
                  ? 'Set a target value to see when it’s reached'
                  : cross == null
                    ? 'Target not reached within 100 years'
                    : cross <= years
                      ? `Reaches ${formatMoney(target, 'EUR')} in ~${cross} years`
                      : `Reaches ${formatMoney(target, 'EUR')} in ~${cross} years (beyond chart)`}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-faint">
        Starting from {formatMoney(initial, 'EUR')} plus {formatMoney(monthly, 'EUR')}/month, you
        contribute {formatMoney(totalInvested, 'EUR')} over {years} years (the dashed line). Each
        scenario assumes a constant annual return, compounded monthly; the dotted line marks your
        target. Illustrative, not a forecast.
      </p>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  suffix,
  step,
}: {
  label: string
  value: number
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  suffix?: string
  step?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <span className="flex items-center gap-1 rounded-md border border-border px-2 py-1.5">
        <input
          type="number"
          value={value}
          onChange={onChange}
          step={step}
          className="w-full bg-transparent text-sm text-foreground outline-none"
        />
        {suffix && <span className="text-xs text-faint">{suffix}</span>}
      </span>
    </label>
  )
}
