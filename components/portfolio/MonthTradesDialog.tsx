'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { TradeDetail } from '@/lib/portfolio/performance-series'
import { formatMoney } from '@/lib/utils/format'

/** Modal listing the buy/sell trades for one month (`YYYY-MM`). Null month = closed. */
export function MonthTradesDialog({
  month,
  trades,
  currency,
  onClose,
}: {
  month: string | null
  trades: TradeDetail[]
  currency: string
  onClose: () => void
}) {
  useEffect(() => {
    if (!month) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [month, onClose])

  if (!month) return null

  const rows = trades
    .filter((t) => t.date.slice(0, 7) === month)
    .sort((a, b) => a.date.localeCompare(b.date))
  const label = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
    new Date(`${month}-01T00:00:00Z`),
  )
  // Net € traded that month (buys spend, sells return): −Σ amount.
  const net = rows.reduce((s, t) => s - (t.amount ?? 0), 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Trades in ${label}`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl border border-border bg-panel shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{label}</h2>
            <p className="text-xs text-muted">
              {rows.length} trade{rows.length === 1 ? '' : 's'} · net{' '}
              <span className={net >= 0 ? 'text-positive' : 'text-negative'}>
                {net >= 0 ? '+' : '−'}
                {formatMoney(Math.abs(net), currency)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-muted hover:bg-panel-elevated hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-2 py-2">
          {rows.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted">No trades this month.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-faint">
                  <th className="px-2 py-1 font-medium">Date</th>
                  <th className="px-2 py-1 font-medium">Instrument</th>
                  <th className="px-2 py-1 text-right font-medium">Shares</th>
                  <th className="px-2 py-1 text-right font-medium">Price</th>
                  <th className="px-2 py-1 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t, i) => (
                  <tr key={i} className="border-t border-border/50">
                    <td className="whitespace-nowrap px-2 py-1.5 text-muted">{t.date.slice(8, 10)}</td>
                    <td className="px-2 py-1.5">
                      <span
                        className={
                          t.type === 'buy'
                            ? 'mr-1.5 rounded bg-positive/10 px-1 py-0.5 text-[10px] uppercase text-positive'
                            : 'mr-1.5 rounded bg-negative/10 px-1 py-0.5 text-[10px] uppercase text-negative'
                        }
                      >
                        {t.type}
                      </span>
                      {t.name ?? t.isin ?? '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted">
                      {t.quantity != null ? t.quantity.toFixed(4) : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted">
                      {t.price != null ? formatMoney(t.price, currency) : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {t.amount != null ? formatMoney(Math.abs(t.amount), currency) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
