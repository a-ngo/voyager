import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Upload, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AllocationDonut } from '@/components/charts/AllocationDonut'
import { TransactionsTable } from '@/components/portfolio/TransactionsTable'
import { InstrumentLabel } from '@/components/portfolio/InstrumentLabel'
import { createClient } from '@/lib/supabase/server'
import { getValuedOverview } from '@/lib/portfolio/valued-overview'
import { formatMoney, formatQuantity } from '@/lib/utils/format'
import { Money } from '@/components/shared/Money'

export default async function PortfolioPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const o = await getValuedOverview(user.id)

  if (!o.hasData) {
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

  const c = o.currency
  const recent = [...o.transactions].reverse().slice(0, 10)
  const returnTone = o.totalReturnAbs >= 0 ? 'text-positive' : 'text-negative'

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Portfolio" description="Holdings reconstructed from your transaction ledger." />

      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-3 py-5">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-faint">Net worth</div>
            <div className="text-3xl font-semibold tabular-nums text-foreground">
              <Money value={o.netWorth} currency={c} />
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-faint">Total return</div>
            <div className={`text-xl font-semibold tabular-nums ${returnTone}`}>
              {o.totalReturnAbs >= 0 ? '+' : ''}
              <Money value={o.totalReturnAbs} currency={c} /> ({o.totalReturnPct.toFixed(1)}%)
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Market value" value={formatMoney(o.marketValue, c)} />
        <Stat
          label="Unrealized P/L"
          value={formatMoney(o.unrealizedPnl, c)}
          tone={o.unrealizedPnl >= 0 ? 'positive' : 'negative'}
        />
        <Stat label="Cash" value={formatMoney(o.cash, c)} />
        <Stat label="Invested (cost)" value={formatMoney(o.investedAtCost, c)} tone="muted" />
        <Stat label="Net contributions" value={formatMoney(o.netContributions, c)} tone="muted" />
        <Stat label="Income received" value={formatMoney(o.income, c)} tone="positive" />
        <Stat
          label="Realized P/L"
          value={formatMoney(o.realizedPnl, c)}
          tone={o.realizedPnl >= 0 ? 'positive' : 'negative'}
        />
        <Stat label="Fees paid" value={formatMoney(o.fees, c)} tone="muted" />
      </div>

      {o.unpricedCount > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <AlertTriangle className="h-3.5 w-3.5 text-negative" />
          {o.unpricedCount} holding{o.unpricedCount > 1 ? 's' : ''} could not be priced and are
          excluded from market value.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Allocation (by market value)</CardTitle>
        </CardHeader>
        <CardContent>
          <AllocationDonut slices={o.allocation} currency={c} />
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
                  <th className="py-2 text-left font-medium">ISIN</th>
                  <th className="py-2 text-right font-medium">Quantity</th>
                  <th className="py-2 text-right font-medium">Avg cost</th>
                  <th className="py-2 text-right font-medium">Price</th>
                  <th className="py-2 text-right font-medium">Market value</th>
                  <th className="py-2 text-right font-medium">Unrealized</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {o.positions.map((p) => {
                  const pnlTone =
                    p.unrealizedPnl == null
                      ? 'text-faint'
                      : p.unrealizedPnl >= 0
                        ? 'text-positive'
                        : 'text-negative'
                  return (
                    <tr key={p.key}>
                      <td className="py-2">
                        <InstrumentLabel name={p.label} isin={p.isin} />
                      </td>
                      <td className="py-2 text-right tabular-nums text-muted">
                        {formatQuantity(p.quantity)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-muted">
                        <Money value={p.averageCost} currency={c} />
                      </td>
                      <td className="py-2 text-right tabular-nums text-muted">
                        {p.price == null ? 'no price' : <Money value={p.price} currency={c} />}
                      </td>
                      <td className="py-2 text-right tabular-nums text-foreground">
                        {p.marketValue == null ? '—' : <Money value={p.marketValue} currency={c} />}
                      </td>
                      <td className={`py-2 text-right tabular-nums ${pnlTone}`}>
                        {p.unrealizedPnl == null ? '—' : <Money value={p.unrealizedPnl} currency={c} />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Recent transactions</CardTitle>
          <Link href="/transactions" className="text-xs text-brand hover:underline">
            See all {o.transactions.length} →
          </Link>
        </CardHeader>
        <CardContent>
          <TransactionsTable rows={recent} names={o.names} />
        </CardContent>
      </Card>

      <p className="text-xs text-faint">
        {o.asOf ? `Prices as of ${o.asOf} · ` : ''}source Yahoo Finance · FX ECB. Cost basis uses the
        average-cost method. Not financial advice.
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
      <div className={`anon-amount text-lg font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-faint">{label}</div>
    </div>
  )
}
