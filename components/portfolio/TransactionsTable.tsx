import type { TransactionRow } from '@/lib/db/transactions'
import { InstrumentLabel } from './InstrumentLabel'
import { displayName } from '@/lib/prices/resolve'
import { formatDate, formatQuantity } from '@/lib/utils/format'
import { Money } from '@/components/shared/Money'

/** Presentational ledger table. `rows` should already be in display order. */
export function TransactionsTable({
  rows,
  names = {},
}: {
  rows: TransactionRow[]
  names?: Record<string, string>
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-[10px] uppercase tracking-widest text-faint">
            <th className="py-2 text-left font-medium">Date</th>
            <th className="py-2 text-left font-medium">Type</th>
            <th className="py-2 text-left font-medium">ISIN</th>
            <th className="py-2 text-right font-medium">Quantity</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((t) => (
            <tr key={t.id}>
              <td className="py-2 text-muted">{formatDate(t.datetime)}</td>
              <td className="py-2 capitalize text-foreground">{t.type}</td>
              <td className="py-2">
                <InstrumentLabel name={displayName(t.isin, t.ticker, names)} isin={t.isin} />
              </td>
              <td className="py-2 text-right tabular-nums text-muted">
                {t.quantity ? formatQuantity(Number(t.quantity)) : '—'}
              </td>
              <td className="py-2 text-right tabular-nums text-muted">
                {t.amount ? <Money value={Number(t.amount)} currency={t.currency} /> : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
