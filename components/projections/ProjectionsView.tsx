'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatMoney } from '@/lib/utils/format'
import { usePortfolioSummary } from '@/hooks/usePortfolioSummary'
import { usePerformanceSeries } from '@/hooks/usePerformanceSeries'
import { project, yearsToReach } from '@/lib/finance/projection'
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

/** Annualize the portfolio's return-on-contributions over its holding period. */
function historicalRate(
  totalReturnPct: number | undefined,
  from: string | undefined,
  to: string | undefined,
): number | null {
  if (totalReturnPct == null || !from || !to) return null
  const years = (Date.parse(to) - Date.parse(from)) / (365 * 86400000)
  if (!(years > 0.1)) return null
  const annual = (Math.pow(1 + totalReturnPct / 100, 1 / years) - 1) * 100
  return Math.round(annual * 10) / 10
}

/** Round to a clean 1 / 2 / 5 × 10ⁿ value (for the default target). */
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
  const { data: perf } = usePerformanceSeries()

  const netWorth = Math.round(summary?.netWorth ?? 0)
  const histAuto =
    historicalRate(summary?.totalReturnPct, perf?.points[0]?.date, perf?.points.at(-1)?.date) ?? 7

  // null = follow the data-derived default; a number = user override.
  const [initial, setInitial] = useState<number | null>(null)
  const [monthly, setMonthly] = useState(500)
  const [years, setYears] = useState(20)
  const [cashRate, setCashRate] = useState(2.25)
  const [histRate, setHistRate] = useState<number | null>(null)
  const [customRate, setCustomRate] = useState(8)
  const [target, setTarget] = useState<number | null>(null)

  const effInitial = initial ?? netWorth
  const effHist = histRate ?? histAuto
  const rates: Record<string, number> = { cash: cashRate, historical: effHist, custom: customRate }

  // Default target: a clean number near the historical scenario ~¾ of the way out.
  const histProj = project({ initial: effInitial, monthlyContribution: monthly, annualRatePct: effHist, years })
  const defaultTarget = niceRound(
    histProj.points[Math.round(years * 0.75)]?.value ?? histProj.finalValue,
  )
  const effTarget = target ?? defaultTarget

  const computed = useMemo(
    () =>
      SCENARIO_META.map((s) => {
        const annualRatePct = rates[s.id] ?? 0
        return {
          meta: s,
          annualRatePct,
          res: project({ initial: effInitial, monthlyContribution: monthly, annualRatePct, years }),
          cross: yearsToReach({ initial: effInitial, monthlyContribution: monthly, annualRatePct, target: effTarget }),
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effInitial, monthly, years, cashRate, effHist, customRate, effTarget],
  )

  const chartData = useMemo(() => {
    const rows: Record<string, number>[] = []
    for (let y = 0; y <= years; y++) {
      const row: Record<string, number> = { year: y }
      for (const { meta, res } of computed) row[meta.id] = res.points[y]?.value ?? res.finalValue
      row.invested = computed[0]?.res.points[y]?.invested ?? effInitial
      rows.push(row)
    }
    return rows
  }, [computed, years, effInitial])

  const markers: TargetMarker[] = computed
    .filter((c) => c.cross != null && c.cross <= years)
    .map((c) => ({ id: c.meta.id, color: c.meta.color, year: c.cross as number }))

  const totalInvested = effInitial + monthly * years * 12

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-6 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Starting value" value={effInitial} onChange={(e) => setInitial(num(e))} suffix="€" />
          <Field label="Monthly saving" value={monthly} onChange={(e) => setMonthly(num(e))} suffix="€" />
          <Field label="Years" value={years} onChange={(e) => setYears(Math.max(1, Math.min(60, num(e))))} />
          <Field label="Target value" value={effTarget} onChange={(e) => setTarget(num(e))} suffix="€" />
          <Field label="Cash interest" value={cashRate} onChange={(e) => setCashRate(num(e))} suffix="%" step="0.05" />
          <Field label="Historical return" value={effHist} onChange={(e) => setHistRate(num(e))} suffix="%" step="0.1" />
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
              target={effTarget}
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
                {cross == null
                  ? 'Target not reached within 100 years'
                  : cross <= years
                    ? `Reaches ${formatMoney(effTarget, 'EUR')} in ~${cross} years`
                    : `Reaches ${formatMoney(effTarget, 'EUR')} in ~${cross} years (beyond chart)`}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-faint">
        Starting from {formatMoney(effInitial, 'EUR')} plus {formatMoney(monthly, 'EUR')}/month,
        you contribute {formatMoney(totalInvested, 'EUR')} over {years} years (the dashed line).
        Each scenario assumes a constant annual return, compounded monthly; the dotted line marks
        your target. Illustrative, not a forecast.
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
