'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatMoney } from '@/lib/utils/format'
import { useXray } from '@/hooks/useXray'
import type { Breakdown } from '@/lib/finance/xray'
import { BarList } from './BarList'

export function XrayView() {
  const { data, isLoading, isError } = useXray()

  if (isLoading)
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted">
          Analyzing your portfolio… looking through funds into their underlying holdings. This can
          take a few seconds on first load.
        </CardContent>
      </Card>
    )
  if (isError || !data)
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-negative">
          Couldn’t load the X-Ray. Try again shortly.
        </CardContent>
      </Card>
    )
  if (!data.hasData)
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted">
          No priced holdings yet — import transactions to analyze your portfolio.
        </CardContent>
      </Card>
    )

  const { currency } = data
  const coverage = (b: Breakdown) =>
    b.coverage < 0.999 ? ` · ${(b.coverage * 100).toFixed(0)}% classified` : ''

  const viaLabel = { direct: 'Direct', fund: 'Fund', both: 'Direct + Fund' } as const
  const viaClass = {
    direct: 'text-brand',
    fund: 'text-muted',
    both: 'text-positive',
  } as const

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Concentration</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Holdings" value={String(data.concentration.holdings)} />
          <Stat label="Largest position" value={`${data.concentration.largestWeight.toFixed(1)}%`} />
          <Stat label="Top 10 weight" value={`${data.concentration.top10Weight.toFixed(1)}%`} />
          <Stat
            label="Effective holdings"
            value={data.concentration.effectiveHoldings.toFixed(1)}
            hint="1 / Σ weight² — diversification, lower means more concentrated"
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Sectors <span className="text-xs font-normal text-faint">{coverage(data.sectors)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarList slices={data.sectors.slices} currency={currency} max={11} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Countries{' '}
              <span className="text-xs font-normal text-faint">{coverage(data.countries)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarList slices={data.countries.slices} currency={currency} max={10} color="#6f94a6" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Currency exposure{' '}
              <span className="text-xs font-normal text-faint">{coverage(data.currencies)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarList slices={data.currencies.slices} currency={currency} max={8} color="#5f8d6a" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Asset class</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList slices={data.assetMix} currency={currency} max={8} color="#9b7bb5" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Top 20 holdings (look-through)</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-faint">
                <th className="px-1 py-1 font-medium">#</th>
                <th className="px-1 py-1 font-medium">Holding</th>
                <th className="px-1 py-1 font-medium">Sector</th>
                <th className="px-1 py-1 font-medium">Via</th>
                <th className="px-1 py-1 text-right font-medium">Weight</th>
                <th className="px-1 py-1 text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {data.topHoldings.map((h, i) => (
                <tr key={h.symbol ?? h.name} className="border-t border-border/50">
                  <td className="px-1 py-1.5 text-muted">{i + 1}</td>
                  <td className="px-1 py-1.5 text-foreground">{h.name}</td>
                  <td className="px-1 py-1.5 text-muted">{h.sector ?? '—'}</td>
                  <td className={`px-1 py-1.5 ${viaClass[h.via]}`}>{viaLabel[h.via]}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums text-muted">
                    {h.weight.toFixed(2)}%
                  </td>
                  <td className="px-1 py-1.5 text-right tabular-nums">
                    {formatMoney(h.value, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-faint">
            Funds are looked through to their top holdings (≈ top 10 each), so weights don’t sum to
            100% — the fund long tail isn’t itemized.
          </p>
        </CardContent>
      </Card>

      {data.overlaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Overlap — held directly and via funds</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.overlaps.map((h) => (
              <div key={h.symbol ?? h.name} className="flex items-baseline justify-between text-xs">
                <span className="text-foreground">{h.name}</span>
                <span className="tabular-nums text-muted">
                  {formatMoney(h.value, currency)} total
                  <span className="text-faint">
                    {' '}
                    ({formatMoney(h.directValue, currency)} direct +{' '}
                    {formatMoney(h.fundValue, currency)} via funds)
                  </span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-faint">
        Look-through data from Yahoo Finance. Sector weights come from each fund directly; country
        and currency are derived from the largest underlying holdings, so they carry a coverage
        figure. Not financial advice.
      </p>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div title={hint}>
      <p className="text-[10px] uppercase tracking-widest text-faint">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}
