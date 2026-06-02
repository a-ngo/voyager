import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function AlertsPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Alerts" description="Rebalancing drift and performance thresholds." />
      <Card>
        <CardHeader>
          <CardTitle>No alerts yet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted">
            Define drift thresholds against your target allocation and get notified by email (Resend)
            when your portfolio wanders out of band.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
