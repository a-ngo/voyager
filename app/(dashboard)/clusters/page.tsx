import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { getInstrumentBreakdown } from '@/lib/portfolio/instruments'
import { ClustersView } from '@/components/clusters/ClustersView'

export default async function ClustersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const breakdown = await getInstrumentBreakdown(user.id)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Clusters"
        description="Group your holdings into custom buckets — core, satellite, and whatever else — and compare what each one earned, past trades included."
      />
      {!breakdown.hasData ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted">
            No transactions yet — import some to start grouping holdings into clusters.
          </CardContent>
        </Card>
      ) : (
        <ClustersView instruments={breakdown.instruments} currency={breakdown.currency} />
      )}
    </div>
  )
}
