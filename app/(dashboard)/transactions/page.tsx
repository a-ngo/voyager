import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Upload } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TransactionsTable } from '@/components/portfolio/TransactionsTable'
import { createClient } from '@/lib/supabase/server'
import { getTransactionsForUser } from '@/lib/db/transactions'
import { getInstrumentNames } from '@/lib/prices/names'

export default async function TransactionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const rows = await getTransactionsForUser(user.id)
  const newestFirst = [...rows].reverse()
  const names = await getInstrumentNames(rows.map((r) => r.isin))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Transactions"
        description={`${rows.length} transaction${rows.length === 1 ? '' : 's'} in your ledger.`}
      />

      {rows.length === 0 ? (
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
          <CardContent className="pt-4">
            <TransactionsTable rows={newestFirst} names={names} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
