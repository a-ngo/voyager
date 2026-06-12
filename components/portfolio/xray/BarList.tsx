import { formatMoney } from '@/lib/utils/format'

interface Slice {
  label: string
  value: number
  weight: number
}

/** Horizontal weight bars for an allocation breakdown. */
export function BarList({
  slices,
  currency,
  max = 8,
  color = 'var(--color-brand)',
}: {
  slices: Slice[]
  currency: string
  max?: number
  color?: string
}) {
  if (slices.length === 0) return <p className="text-xs text-muted">No data available.</p>

  const shown = slices.slice(0, max)
  const peak = Math.max(...shown.map((s) => s.weight), 1)

  return (
    <div className="flex flex-col gap-2.5">
      {shown.map((s) => (
        <div key={s.label} className="text-xs">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-foreground">{s.label}</span>
            <span className="whitespace-nowrap tabular-nums text-muted">
              {s.weight.toFixed(1)}% · {formatMoney(s.value, currency)}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded bg-panel-elevated">
            <div
              className="h-1.5 rounded"
              style={{ width: `${(s.weight / peak) * 100}%`, background: color }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
