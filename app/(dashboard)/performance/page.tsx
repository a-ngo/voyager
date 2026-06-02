import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function PerformancePage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Performance"
        description="TWR, MWR and benchmark comparison vs. IWDA.AS (MSCI World)."
      />
      <Card>
        <CardHeader>
          <CardTitle>Coming in Phase 2</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted">
            Time-weighted and money-weighted returns, contribution decomposition, and benchmark
            overlay. Calculations live in <code className="text-brand">lib/finance/</code> as pure,
            unit-tested functions.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
