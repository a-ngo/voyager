'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Money } from '@/components/shared/Money'
import { InfoPopover } from '@/components/shared/InfoPopover'
import { useXray } from '@/hooks/useXray'
import type { Breakdown } from '@/lib/finance/xray'
import { HoldingDetailDialog } from '@/components/portfolio/HoldingDetailDialog'
import { BarList } from './BarList'

// Client-only — bundles the world topojson; keep it out of SSR (like the charts).
const WorldAllocationMap = dynamic(
  () => import('./WorldAllocationMap').then((m) => m.WorldAllocationMap),
  { ssr: false },
)

export function XrayView() {
  const { data, isLoading, isError } = useXray()
  const [openHolding, setOpenHolding] = useState<{ symbol: string; name: string } | null>(null)

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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Geographic allocation{' '}
            <span className="text-xs font-normal text-faint">{coverage(data.countries)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WorldAllocationMap slices={data.countries.slices} coverage={data.countries.coverage} />
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
              Regions{' '}
              <span className="text-xs font-normal text-faint">{coverage(data.regions)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarList slices={data.regions.slices} currency={currency} max={6} color="#c98a3c" />
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
              {data.topHoldings.map((h, i) => {
                const clickable = !!h.symbol
                return (
                  <tr
                    key={h.symbol ?? h.name}
                    className={
                      clickable
                        ? 'cursor-pointer border-t border-border/50 hover:bg-panel-elevated'
                        : 'border-t border-border/50'
                    }
                    onClick={
                      clickable ? () => setOpenHolding({ symbol: h.symbol!, name: h.name }) : undefined
                    }
                  >
                    <td className="px-1 py-1.5 text-muted">{i + 1}</td>
                    <td className="px-1 py-1.5 text-foreground">{h.name}</td>
                    <td className="px-1 py-1.5 text-muted">{h.sector ?? '—'}</td>
                    <td className={`px-1 py-1.5 ${viaClass[h.via]}`}>{viaLabel[h.via]}</td>
                    <td className="px-1 py-1.5 text-right tabular-nums text-muted">
                      {h.weight.toFixed(2)}%
                    </td>
                    <td className="px-1 py-1.5 text-right tabular-nums">
                      <Money value={h.value} currency={currency} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-faint">
            Click a holding for fundamentals + analyst data. Funds are looked through to their top
            holdings (≈ top 10 each), so weights don’t sum to 100% — the fund long tail isn’t
            itemized.
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
                  <Money value={h.value} currency={currency} /> total
                  <span className="text-faint">
                    {' '}
                    (<Money value={h.directValue} currency={currency} /> direct +{' '}
                    <Money value={h.fundValue} currency={currency} /> via funds)
                  </span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(data.cost.funds.length > 0 || data.cost.coverage < 0.999) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1 text-sm">
              Annual cost (TER)
              <InfoPopover label="Total expense ratio (TER)">
                The annual fee charged by your funds, expressed as a percentage of assets under
                management. Shown blended across the portfolio (each fund weighted by its value) and
                as an annual amount. Direct stocks carry no such fee.
              </InfoPopover>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-medium text-foreground">
                {data.cost.weightedTerPct.toFixed(2)}%
              </span>
              <span className="text-sm text-muted">
                <Money value={data.cost.annualCost} /> per year
              </span>
            </div>
            {data.cost.funds.length === 0 ? (
              <p className="text-xs text-muted">No fund expense ratios available.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {data.cost.funds.slice(0, 8).map((f) => (
                  <div key={f.name} className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate text-foreground">{f.name}</span>
                    <span className="whitespace-nowrap tabular-nums text-muted">
                      {f.terPct.toFixed(2)}% · <Money value={f.annualCost} />/yr
                    </span>
                  </div>
                ))}
              </div>
            )}
            {data.cost.coverage < 0.999 && (
              <p className="text-xs text-faint">
                TER known for {(data.cost.coverage * 100).toFixed(0)}% of holdings by value.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-faint">
        Look-through data from Yahoo Finance. Sector weights come from each fund directly; country
        and currency are derived from the largest underlying holdings, so they carry a coverage
        figure. Not financial advice.
      </p>

      <HoldingDetailDialog
        symbol={openHolding?.symbol ?? null}
        name={openHolding?.name}
        onClose={() => setOpenHolding(null)}
      />
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
