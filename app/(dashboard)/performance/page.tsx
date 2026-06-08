import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Upload } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PerformanceChart } from '@/components/charts/PerformanceChart'
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
        <Card>
          <CardHeader>
            <CardTitle>Value over time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <PerformanceChart points={series.points} currency={series.currency} />
            </div>
            <p className="mt-3 text-xs text-faint">
              Monthly closes · source Yahoo Finance · FX at current ECB rates.
              {series.missing.length > 0 &&
                ` ${series.missing.length} holding(s) lacked price history and are excluded.`}{' '}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
