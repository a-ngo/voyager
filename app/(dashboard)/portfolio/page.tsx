import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Upload } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AllocationDonut } from '@/components/charts/AllocationDonut'
import { createClient } from '@/lib/supabase/server'
import { getTransactionsForUser } from '@/lib/db/transactions'
import { buildOverview, toLedger } from '@/lib/portfolio/overview'
import { formatDate, formatMoney, formatQuantity } from '@/lib/utils/format'

export default async function PortfolioPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const rows = await getTransactionsForUser(user.id)
  const overview = buildOverview(toLedger(rows))

  if (!overview.hasData) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Portfolio" description="Holdings reconstructed from your transaction ledger." />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Upload className="h-7 w-7 text-brand" />
            <p className="text-sm text-foreground">No transactions yet.</p>
            <p className="max-w-sm text-xs text-muted">
              Import a Trade Republic CSV and your holdings, allocation, and ledger appear here.
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

  const c = overview.currency
  const recent = [...rows].reverse().slice(0, 25)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Portfolio" description="Holdings reconstructed from your transaction ledger." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Invested (cost)" value={formatMoney(overview.investedAtCost, c)} />
        <Stat label="Cash" value={formatMoney(overview.cash, c)} />
        <Stat label="Net contributions" value={formatMoney(overview.netContributions, c)} />
        <Stat label="Income received" value={formatMoney(overview.income, c)} tone="positive" />
        <Stat
          label="Realized P/L"
          value={formatMoney(overview.realizedPnl, c)}
          tone={overview.realizedPnl >= 0 ? 'positive' : 'negative'}
        />
        <Stat label="Fees paid" value={formatMoney(overview.fees, c)} tone="muted" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Allocation (by cost basis)</CardTitle>
        </CardHeader>
        <CardContent>
          <AllocationDonut slices={overview.allocation} currency={c} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-widest text-faint">
                  <th className="py-2 text-left font-medium">Instrument</th>
                  <th className="py-2 text-left font-medium">Class</th>
                  <th className="py-2 text-right font-medium">Quantity</th>
                  <th className="py-2 text-right font-medium">Avg cost</th>
                  <th className="py-2 text-right font-medium">Cost basis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {overview.positions.map((p) => (
                  <tr key={p.key}>
                    <td className="py-2 text-foreground">{p.label}</td>
                    <td className="py-2 capitalize text-muted">{p.assetClass ?? '—'}</td>
                    <td className="py-2 text-right tabular-nums text-muted">
                      {formatQuantity(p.quantity)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted">
                      {formatMoney(p.averageCost, p.currency)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-foreground">
                      {formatMoney(p.costBasis, p.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transactions ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-widest text-faint">
                  <th className="py-2 text-left font-medium">Date</th>
                  <th className="py-2 text-left font-medium">Type</th>
                  <th className="py-2 text-left font-medium">Instrument</th>
                  <th className="py-2 text-right font-medium">Quantity</th>
                  <th className="py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recent.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2 text-muted">{formatDate(t.datetime)}</td>
                    <td className="py-2 capitalize text-foreground">{t.type}</td>
                    <td className="py-2 text-muted">{t.ticker ?? t.isin ?? '—'}</td>
                    <td className="py-2 text-right tabular-nums text-muted">
                      {t.quantity ? formatQuantity(Number(t.quantity)) : '—'}
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted">
                      {t.amount ? formatMoney(Number(t.amount), t.currency) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > recent.length && (
            <p className="mt-3 text-xs text-faint">Showing the {recent.length} most recent.</p>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-faint">
        Values shown at cost basis. Market value, unrealized gains, and total return arrive with the
        price layer. Not financial advice.
      </p>
    </div>
  )
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'positive' | 'negative' | 'muted'
}) {
  const color =
    tone === 'positive'
      ? 'text-positive'
      : tone === 'negative'
        ? 'text-negative'
        : tone === 'muted'
          ? 'text-muted'
          : 'text-foreground'
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-panel-elevated p-3">
      <div className={`text-lg font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-faint">{label}</div>
    </div>
  )
}
