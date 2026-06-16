'use client'

import dynamic from 'next/dynamic'
import { Money } from '@/components/shared/Money'
import { decomposeContributions } from '@/lib/finance/contribution'
import type { ValuePoint } from '@/lib/finance/returns'

const ContributionChart = dynamic(
  () => import('./ContributionChart').then((m) => m.ContributionChart),
  { ssr: false },
)

/** Splits portfolio value into contributed capital vs. market return, in total
 *  and per year. All-time (since inception), independent of the window selector. */
export function ContributionBreakdown({
  points,
  currency,
}: {
  points: ValuePoint[]
  currency: string
}) {
  const d = decomposeContributions(points)
  if (!d) return <p className="text-sm text-muted">Not enough history yet to attribute returns.</p>

  const sharePct = d.marketShare != null ? Math.round(d.marketShare * 100) : null
  const normalSplit = sharePct != null && d.marketGain >= 0 && d.contributions >= 0

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Invested capital">
          <Money value={d.contributions} currency={currency} />
        </Stat>
        <Stat label="Market return">
          <span className={d.marketGain >= 0 ? 'text-positive' : 'text-negative'}>
            <Money value={d.marketGain} currency={currency} />
          </span>
        </Stat>
        <Stat label="Current value">
          <Money value={d.endValue} currency={currency} />
        </Stat>
      </div>

      {normalSplit ? (
        <p className="text-xs text-muted">
          Market return accounts for {sharePct}% of current value; contributed capital the remaining{' '}
          {100 - (sharePct as number)}%.
        </p>
      ) : sharePct != null ? (
        <p className="text-xs text-muted">Market return equals {sharePct}% of current value.</p>
      ) : null}

      <div className="h-72">
        <ContributionChart periods={d.periods} currency={currency} />
      </div>

      <p className="text-xs text-faint">
        Since inception, independent of the window above. Each year splits the change in value into
        net contributions and market return (price moves, dividends, fees). Market return is value
        minus contributed capital.
      </p>
    </div>
  )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-faint">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{children}</p>
    </div>
  )
}
