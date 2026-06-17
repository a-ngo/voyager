'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ArrowRight, ScanSearch, Telescope, Boxes, MessageSquare, Newspaper, Upload } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Money } from '@/components/shared/Money'
import type { PerfPoint } from '@/lib/finance/performance'

const PerformanceChart = dynamic(
  () => import('@/components/charts/PerformanceChart').then((m) => m.PerformanceChart),
  { ssr: false },
)
const AllocationDonut = dynamic(
  () => import('@/components/charts/AllocationDonut').then((m) => m.AllocationDonut),
  { ssr: false },
)

export interface HomeDriftItem {
  label: string
  currentPct: number
  targetPct: number
  driftPct: number
  breached: boolean
}

export interface HomeHolding {
  label: string
  marketValue: number
  weight: number
  returnPct: number | null
}

export interface HomeActivity {
  date: string
  type: string
  name: string
  amount: number
}

export interface HomeData {
  currency: string
  netWorth: number
  marketValue: number
  cash: number
  invested: number
  income: number
  totalReturnAbs: number
  totalReturnPct: number
  unrealizedPnl: number
  realizedPnl: number
  asOf: string | null
  allocation: { label: string; value: number; weight: number; color: string }[]
  hasTargets: boolean
  drift: HomeDriftItem[]
  topHoldings: HomeHolding[]
  recent: HomeActivity[]
  perf: PerfPoint[]
}

const QUICK_LINKS = [
  { href: '/xray', label: 'X-Ray', desc: 'Look through your funds', icon: ScanSearch },
  { href: '/projections', label: 'Projections', desc: 'Model the future', icon: Telescope },
  { href: '/clusters', label: 'Clusters', desc: 'Group & compare', icon: Boxes },
  { href: '/assistant', label: 'Assistant', desc: 'Ask about your portfolio', icon: MessageSquare },
  { href: '/news', label: 'News', desc: 'Headlines for your holdings', icon: Newspaper },
  { href: '/import', label: 'Import', desc: 'Add a broker export', icon: Upload },
] as const

const signClass = (v: number) => (v > 0 ? 'text-positive' : v < 0 ? 'text-negative' : 'text-muted')
const pct = (f: number) => `${f >= 0 ? '+' : ''}${f.toFixed(1)}%`

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function HomeView({ data }: { data: HomeData }) {
  const { currency } = data
  // Greeting depends on the client clock; render a stable value first to avoid hydration mismatch.
  const [hello, setHello] = useState('Welcome back')
  useEffect(() => setHello(greeting()), [])

  return (
    <div className="flex flex-col gap-4">
      {/* Hero */}
      <div className="rounded-xl border border-border bg-panel p-6">
        <p className="text-sm text-muted">{hello}</p>
        <div className="mt-1 flex flex-wrap items-end gap-x-4 gap-y-1">
          <span className="text-3xl font-semibold tracking-tight text-foreground">
            <Money value={data.netWorth} currency={currency} />
          </span>
          <span className={`pb-0.5 text-sm font-medium ${signClass(data.totalReturnAbs)}`}>
            {data.totalReturnAbs >= 0 ? '+' : ''}
            <Money value={data.totalReturnAbs} currency={currency} /> ({pct(data.totalReturnPct)})
          </span>
        </div>
        <p className="mt-1 text-xs text-faint">
          Net worth · total return{data.asOf ? ` · as of ${data.asOf}` : ''}
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Market value" value={<Money value={data.marketValue} currency={currency} />} />
        <Kpi label="Invested" value={<Money value={data.invested} currency={currency} />} />
        <Kpi label="Cash" value={<Money value={data.cash} currency={currency} />} />
        <Kpi label="Income" value={<Money value={data.income} currency={currency} />} />
      </div>

      {/* Performance + allocation */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Performance</CardTitle>
            <SeeMore href="/performance" />
          </CardHeader>
          <CardContent>
            <div className="h-56">
              {data.perf.length > 1 ? (
                <PerformanceChart points={data.perf} currency={currency} />
              ) : (
                <Empty>Not enough history yet.</Empty>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Allocation</CardTitle>
            <SeeMore href="/xray" />
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <AllocationDonut slices={data.allocation} currency={currency} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drift + top holdings + activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Target drift</CardTitle>
            <SeeMore href="/portfolio" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {!data.hasTargets ? (
              <p className="text-xs text-muted">
                No target allocation set. Define one to track rebalancing drift.
              </p>
            ) : data.drift.length === 0 ? (
              <p className="text-xs text-muted">On target.</p>
            ) : (
              data.drift.map((d) => (
                <div key={d.label} className="flex items-baseline justify-between">
                  <span className="text-foreground">{d.label}</span>
                  <span className="flex items-baseline gap-2 tabular-nums">
                    <span className="text-xs text-faint">
                      {d.currentPct.toFixed(0)}% / {d.targetPct.toFixed(0)}%
                    </span>
                    <span className={d.breached ? 'font-medium text-negative' : 'text-muted'}>
                      {pct(d.driftPct)}
                    </span>
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Top holdings</CardTitle>
            <SeeMore href="/portfolio" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {data.topHoldings.length === 0 ? (
              <Empty>No priced holdings.</Empty>
            ) : (
              data.topHoldings.map((h) => (
                <div key={h.label} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-foreground" title={h.label}>
                    {h.label}
                  </span>
                  <span className="shrink-0 text-xs text-faint">{h.weight.toFixed(1)}%</span>
                  <span className={`shrink-0 w-14 text-right tabular-nums ${h.returnPct == null ? 'text-muted' : signClass(h.returnPct)}`}>
                    {h.returnPct == null ? '—' : pct(h.returnPct)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Recent activity</CardTitle>
            <SeeMore href="/transactions" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {data.recent.length === 0 ? (
              <Empty>No transactions.</Empty>
            ) : (
              data.recent.map((t, i) => (
                <div key={`${t.date}-${i}`} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-foreground">{t.name}</span>{' '}
                    <span className="text-faint capitalize">{t.type}</span>
                  </span>
                  <span className={`shrink-0 tabular-nums ${signClass(t.amount)}`}>
                    <Money value={t.amount} currency={currency} />
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {QUICK_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex flex-col gap-1 rounded-lg border border-border bg-panel p-3 transition-colors hover:border-brand"
          >
            <l.icon className="h-4 w-4 text-brand" />
            <span className="text-sm font-medium text-foreground">{l.label}</span>
            <span className="text-xs text-faint">{l.desc}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-3">
      <p className="text-[10px] uppercase tracking-widest text-faint">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}

function SeeMore({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-brand"
    >
      View <ArrowRight className="h-3 w-3" />
    </Link>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-xs text-faint">{children}</p>
}
