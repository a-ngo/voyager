'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { formatMoney } from '@/lib/utils/format'
import { useInstrumentDetail } from '@/hooks/useInstrumentDetail'
import type { InstrumentDetail } from '@/lib/prices/yahoo-fundamentals'

/** Fundamentals + analyst detail modal for one holding. Null symbol = closed. */
export function HoldingDetailDialog({
  symbol,
  name,
  onClose,
}: {
  symbol: string | null
  name?: string
  onClose: () => void
}) {
  const { data, isLoading, isError } = useInstrumentDetail(symbol)

  useEffect(() => {
    if (!symbol) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [symbol, onClose])

  if (!symbol) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Details for ${name ?? symbol}`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{data?.name ?? name ?? symbol}</h2>
            <p className="text-xs text-muted">
              {symbol}
              {data && [data.sector, data.industry, data.country].filter(Boolean).length > 0 && (
                <> · {[data.sector, data.industry, data.country].filter(Boolean).join(' · ')}</>
              )}
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

        <div className="overflow-y-auto px-4 py-4">
          {isLoading && <p className="py-8 text-center text-sm text-muted">Loading…</p>}
          {(isError || (!isLoading && !data)) && (
            <p className="py-8 text-center text-sm text-muted">No detail available for this holding.</p>
          )}
          {data && <DetailBody d={data} />}
        </div>
      </div>
    </div>
  )
}

function DetailBody({ d }: { d: InstrumentDetail }) {
  const ccy = d.currency ?? 'USD'
  const pct = (f: number | null) => (f != null ? `${(f * 100).toFixed(2)}%` : '—')
  const money = (v: number | null) => (v != null ? formatMoney(v, ccy) : '—')
  const cap =
    d.marketCap != null
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: ccy,
          notation: 'compact',
          maximumFractionDigits: 2,
        }).format(d.marketCap)
      : '—'

  const recLabel = d.recommendationKey
    ? d.recommendationKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : null
  const t = d.recommendationTrend[0]
  const buy = t ? t.strongBuy + t.buy : 0
  const hold = t ? t.hold : 0
  const sell = t ? t.sell + t.strongSell : 0
  const totalRec = buy + hold + sell

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Stat label="Price" value={money(d.price)} />
        <Stat label="Market cap" value={cap} />
        <Stat label="P/E (TTM)" value={d.trailingPE != null ? d.trailingPE.toFixed(1) : '—'} />
        <Stat label="Fwd P/E" value={d.forwardPE != null ? d.forwardPE.toFixed(1) : '—'} />
        <Stat label="Div yield" value={pct(d.dividendYield)} />
        <Stat label="Beta" value={d.beta != null ? d.beta.toFixed(2) : '—'} />
        <Stat label="Profit margin" value={pct(d.profitMargin)} />
        <Stat label="ROE" value={pct(d.returnOnEquity)} />
      </div>

      {d.fiftyTwoWeekLow != null && d.fiftyTwoWeekHigh != null && d.price != null && (
        <RangeBar
          label="52-week range"
          low={d.fiftyTwoWeekLow}
          high={d.fiftyTwoWeekHigh}
          marker={d.price}
          markerLabel="now"
          money={money}
          color="#c2613f"
        />
      )}

      {d.targetMean != null && d.targetLow != null && d.targetHigh != null && (
        <div className="flex flex-col gap-2">
          <RangeBar
            label="Analyst price targets"
            low={d.targetLow}
            high={d.targetHigh}
            marker={d.targetMean}
            markerLabel="mean"
            secondary={d.price ?? undefined}
            secondaryLabel="now"
            money={money}
            color="#5f8d6a"
          />
          {recLabel && (
            <p className="text-xs text-muted">
              Consensus: <span className="text-foreground">{recLabel}</span>
              {d.numberOfAnalysts != null && <> · {d.numberOfAnalysts} analysts</>}
            </p>
          )}
        </div>
      )}

      {totalRec > 0 && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-widest text-faint">
            Recommendation trend
          </p>
          <div className="flex h-3 overflow-hidden rounded">
            {buy > 0 && <span style={{ width: `${(buy / totalRec) * 100}%`, background: '#5f8d6a' }} />}
            {hold > 0 && <span style={{ width: `${(hold / totalRec) * 100}%`, background: '#9d968a' }} />}
            {sell > 0 && <span style={{ width: `${(sell / totalRec) * 100}%`, background: '#c0584e' }} />}
          </div>
          <p className="mt-1 text-xs text-muted">
            <span className="text-positive">{buy} buy</span> · {hold} hold ·{' '}
            <span className="text-negative">{sell} sell</span>
          </p>
        </div>
      )}

      {d.summary && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-widest text-faint">Business</p>
          <p className="text-xs leading-relaxed text-muted">{d.summary.slice(0, 600)}</p>
        </div>
      )}

      <p className="text-[10px] text-faint">
        Data from Yahoo Finance. Figures are indicative, not financial advice.
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-faint">{label}</p>
      <p className="mt-0.5 text-sm tabular-nums text-foreground">{value}</p>
    </div>
  )
}

function RangeBar({
  label,
  low,
  high,
  marker,
  markerLabel,
  secondary,
  secondaryLabel,
  money,
  color,
}: {
  label: string
  low: number
  high: number
  marker: number
  markerLabel: string
  secondary?: number
  secondaryLabel?: string
  money: (v: number | null) => string
  color: string
}) {
  const span = high - low || 1
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - low) / span) * 100))}%`
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-widest text-faint">{label}</p>
      <div className="relative mt-3 h-1.5 rounded bg-panel-elevated">
        <div className="absolute -top-4 -translate-x-1/2 text-[10px] text-muted" style={{ left: pos(marker) }}>
          {markerLabel}
        </div>
        <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: pos(marker), background: color }} />
        {secondary != null && (
          <div className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-panel" style={{ left: pos(secondary) }} title={secondaryLabel} />
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-muted">
        <span>{money(low)}</span>
        <span className="text-foreground">{markerLabel} {money(marker)}</span>
        <span>{money(high)}</span>
      </div>
    </div>
  )
}
