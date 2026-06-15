'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Money } from '@/components/shared/Money'
import { InfoPopover } from '@/components/shared/InfoPopover'
import {
  simulateMonteCarlo,
  type MonteCarloInput,
  type MonteCarloResult,
} from '@/lib/finance/montecarlo'

const MonteCarloChart = dynamic(() => import('./MonteCarloChart').then((m) => m.MonteCarloChart), {
  ssr: false,
})

function num(e: React.ChangeEvent<HTMLInputElement>): number {
  const n = Number(e.target.value)
  return Number.isFinite(n) ? n : 0
}

/** Stochastic counterpart to the deterministic projection: many randomized
 *  return paths drawn from the expected return + volatility, run in a Web
 *  Worker (§10) with a synchronous fallback when workers are unavailable. */
export function MonteCarloPanel({
  initial,
  monthlyContribution,
  years,
  target,
  defaultReturnPct,
  defaultVolatilityPct,
}: {
  initial: number
  monthlyContribution: number
  years: number
  target: number
  defaultReturnPct: number
  defaultVolatilityPct: number
}) {
  // null = follow the seeded default (return/volatility derived from the data);
  // a number = the user has overridden it. Other inputs never change these.
  const [returnOverride, setReturnOverride] = useState<number | null>(null)
  const [volOverride, setVolOverride] = useState<number | null>(null)
  const [sims, setSims] = useState(1000)
  const [result, setResult] = useState<MonteCarloResult | null>(null)
  const [running, setRunning] = useState(false)
  const workerRef = useRef<Worker | null>(null)

  const returnPct = returnOverride ?? defaultReturnPct
  const volPct = volOverride ?? defaultVolatilityPct

  useEffect(() => () => workerRef.current?.terminate(), [])

  function run() {
    const input: MonteCarloInput = {
      initial,
      monthlyContribution,
      annualReturnPct: returnPct,
      annualVolatilityPct: volPct,
      years,
      target: target > 0 ? target : null,
      simulations: sims,
      seed: 1,
    }
    setRunning(true)
    const finish = (r: MonteCarloResult) => {
      setResult(r)
      setRunning(false)
    }
    try {
      if (!workerRef.current) {
        const w = new Worker(new URL('./montecarlo.worker.ts', import.meta.url))
        w.onmessage = (e: MessageEvent<MonteCarloResult>) => finish(e.data)
        w.onerror = () => finish(simulateMonteCarlo(input))
        workerRef.current = w
      }
      workerRef.current.postMessage(input)
    } catch {
      // Workers unavailable in this environment — run on the main thread.
      setTimeout(() => finish(simulateMonteCarlo(input)), 0)
    }
  }

  const finalBand = result?.bands.at(-1) ?? null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1 text-sm">
          Monte Carlo simulation
          <InfoPopover label="Monte Carlo simulation">
            Rather than a single fixed return, this runs many randomized return paths. Each month
            draws a return from a distribution defined by the expected return and the volatility (the
            year-to-year variation observed in the portfolio), then adds the contribution. The shaded
            band spans the 10th to 90th percentile of outcomes and the line marks the median,
            describing the range of results the assumptions imply rather than one deterministic
            figure.
          </InfoPopover>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field
            label="Expected return"
            value={returnPct}
            onChange={(e) => setReturnOverride(num(e))}
            suffix="%"
            step="0.1"
          />
          <Field
            label="Volatility"
            value={volPct}
            onChange={(e) => setVolOverride(num(e))}
            suffix="%"
            step="0.5"
          />
          <Field
            label="Simulations"
            value={sims}
            onChange={(e) => setSims(Math.max(100, Math.min(20000, Math.round(num(e)))))}
          />
          <div className="flex items-end">
            <Button variant="brand" onClick={run} disabled={running} className="w-full">
              {running ? 'Running…' : result ? 'Run again' : 'Run simulation'}
            </Button>
          </div>
        </div>

        {result ? (
          <>
            <div className="h-72">
              <MonteCarloChart
                bands={result.bands}
                currency="EUR"
                target={target > 0 ? target : undefined}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <Stat label={`Median after ${years}y`}>
                <Money value={finalBand?.p50 ?? 0} />
              </Stat>
              <Stat label="10th–90th percentile">
                <Money value={finalBand?.p10 ?? 0} /> – <Money value={finalBand?.p90 ?? 0} />
              </Stat>
              {result.probReachTarget != null && (
                <Stat label="Reaches target">
                  {(result.probReachTarget * 100).toFixed(0)}% of paths
                </Stat>
              )}
            </div>
            <p className="text-xs text-faint">
              {result.simulations.toLocaleString()} simulated paths with monthly lognormal returns.
              The band spans the 10th to 90th percentile; the line is the median. Illustrative, not a
              forecast.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">
            Run a simulation to see the range of outcomes these assumptions imply, not just a single
            path.
          </p>
        )}
      </CardContent>
    </Card>
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

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-faint">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{children}</p>
    </div>
  )
}
