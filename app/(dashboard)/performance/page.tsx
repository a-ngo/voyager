import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Upload } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PerformanceWithBenchmark } from '@/components/portfolio/PerformanceWithBenchmark'
import { ContributionBreakdown } from '@/components/portfolio/ContributionBreakdown'
import { InfoPopover } from '@/components/shared/InfoPopover'
import { createClient } from '@/lib/supabase/server'
import { getPerformanceSeries } from '@/lib/portfolio/performance-series'

export default async function PerformancePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const series = await getPerformanceSeries(user.id)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Performance"
        description="Portfolio value vs. money invested, over time."
      />

      {!series.hasData ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Upload className="h-7 w-7 text-brand" />
            <p className="text-sm text-foreground">No transactions yet.</p>
            <Link href="/import">
              <Button variant="brand" size="sm">
                <Upload className="h-4 w-4" /> Import transactions
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Value over time</CardTitle>
            </CardHeader>
            <CardContent>
              <PerformanceWithBenchmark
                points={series.points}
                currency={series.currency}
                trades={series.trades}
              />
              <p className="mt-3 text-xs text-faint">
                Monthly closes · source Yahoo Finance · FX at current ECB rates. Benchmarks replay
                your deposits into the chosen basket (buy-and-hold, EUR).
                {series.missing.length > 0 &&
                  ` ${series.missing.length} holding(s) lacked price history and are excluded.`}{' '}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1">
                Contribution vs. market return
                <InfoPopover label="Contribution vs. market return" wide>
                  <span className="block">
                    A decomposition of portfolio value into the capital contributed (deposits net of
                    withdrawals) and the gain the market added on top of it. Market return is the
                    current value minus contributed capital, and includes price changes, dividends,
                    and fees.
                  </span>
                  <span className="mt-1.5 block">
                    The per-year bars show, for each year, how much of the change in value came from
                    new contributions versus market movement. It explains the gap between the
                    time-weighted and money-weighted returns, which arises from the timing of
                    contributions.
                  </span>
                </InfoPopover>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ContributionBreakdown points={series.points} currency={series.currency} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
