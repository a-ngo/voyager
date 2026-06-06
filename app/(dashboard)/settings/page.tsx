import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TargetAllocationForm } from '@/components/settings/TargetAllocationForm'
import { DeletePortfolioButton } from '@/components/settings/DeletePortfolioButton'
import { createClient } from '@/lib/supabase/server'
import { getTargetAllocations } from '@/lib/db/transactions'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const targets = await getTargetAllocations(user.id)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Settings" description="Configure how your portfolio is tracked." />
      <Card>
        <CardHeader>
          <CardTitle>Target allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-muted">
            Set a target weight per asset class. The dashboard&apos;s allocation-vs-target widget
            compares your live allocation against these and flags drift.
          </p>
          <TargetAllocationForm initialTargets={targets} />
        </CardContent>
      </Card>

      <Card className="border-negative/30">
        <CardHeader>
          <CardTitle className="text-negative">Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-muted">
            Delete all transactions and reset the portfolio so you can import from scratch. Your
            account stays; only portfolio data is removed.
          </p>
          <DeletePortfolioButton />
        </CardContent>
      </Card>
    </div>
  )
}
