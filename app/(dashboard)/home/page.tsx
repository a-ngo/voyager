import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Upload, LineChart } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { getValuedOverview } from '@/lib/portfolio/valued-overview'
import { getPerformanceSeries } from '@/lib/portfolio/performance-series'
import { computeDrift } from '@/lib/finance/drift'
import { HomeView, type HomeData } from '@/components/home/HomeView'

const DRIFT_THRESHOLD_PCT = 5

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const overview = await getValuedOverview(user.id)

  if (!overview.hasData) {
    return (
      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <LineChart className="h-8 w-8 text-brand" />
            <h1 className="text-lg font-semibold text-foreground">Welcome to Voyager</h1>
            <p className="max-w-sm text-sm text-muted">
              Import a broker export and Voyager reconstructs your holdings, prices them, and tracks
              performance, allocation, and returns.
            </p>
            <Link href="/import">
              <Button variant="brand" size="sm">
                <Upload className="h-4 w-4" /> Import transactions
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const perf = await getPerformanceSeries(user.id)

  const bucketLabel = new Map<string, string>(overview.allocation.map((s) => [s.bucket, s.label]))
  const current: Record<string, number> = {}
  for (const s of overview.allocation) current[s.bucket] = s.weight
  const report = computeDrift(current, overview.targets, DRIFT_THRESHOLD_PCT)
  const drift = report.items
    .filter((i) => i.current > 0.5 || i.target > 0.5)
    .slice(0, 4)
    .map((i) => ({
      label: bucketLabel.get(i.key) ?? i.key,
      currentPct: i.current,
      targetPct: i.target,
      driftPct: i.drift,
      breached: i.breached,
    }))

  const topHoldings = overview.positions
    .filter((p) => p.marketValue != null)
    .slice(0, 6)
    .map((p) => ({
      label: p.label,
      marketValue: p.marketValue ?? 0,
      weight: overview.marketValue > 0 ? ((p.marketValue ?? 0) / overview.marketValue) * 100 : 0,
      returnPct:
        p.costBasis > 0 && p.unrealizedPnl != null ? (p.unrealizedPnl / p.costBasis) * 100 : null,
    }))

  const recent = [...overview.transactions]
    .slice(-6)
    .reverse()
    .map((t) => ({
      date: t.date,
      type: t.type,
      name: t.name ?? (t.isin ? overview.names[t.isin] : null) ?? t.isin ?? t.type,
      amount: Number(t.amount ?? 0),
    }))

  const data: HomeData = {
    currency: overview.currency,
    netWorth: overview.netWorth,
    marketValue: overview.marketValue,
    cash: overview.cash,
    invested: overview.investedAtCost,
    income: overview.income,
    totalReturnAbs: overview.totalReturnAbs,
    totalReturnPct: overview.totalReturnPct,
    unrealizedPnl: overview.unrealizedPnl,
    realizedPnl: overview.realizedPnl,
    asOf: overview.asOf,
    allocation: overview.allocation.map((s) => ({
      label: s.label,
      value: s.value,
      weight: s.weight,
      color: s.color,
    })),
    hasTargets: Object.keys(overview.targets).length > 0,
    drift,
    topHoldings,
    recent,
    perf: perf.points,
  }

  return <HomeView data={data} />
}
