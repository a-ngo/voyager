import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MOCK_ALLOCATION } from '@/lib/portfolio/mock'

export default function PortfolioPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Portfolio" description="Holdings reconstructed from your transaction ledger." />
      <Card>
        <CardHeader>
          <CardTitle>Current allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {MOCK_ALLOCATION.map((slice) => (
              <li key={slice.label} className="flex items-center justify-between py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: slice.color }} />
                  <span className="text-foreground">{slice.label}</span>
                </span>
                <span className="tabular-nums text-muted">{slice.value}%</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-faint">
            Placeholder data. Import your Trade Republic history to populate real holdings.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
