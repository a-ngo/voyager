'use client'

import dynamic from 'next/dynamic'
import { Money } from '@/components/shared/Money'
import { InfoPopover } from '@/components/shared/InfoPopover'
import { decomposeContributions, type IncomeEvent } from '@/lib/finance/contribution'
import type { ValuePoint } from '@/lib/finance/returns'

const ContributionChart = dynamic(
  () => import('./ContributionChart').then((m) => m.ContributionChart),
  { ssr: false },
)

/** Splits portfolio value into contributed capital, price return, and income,
 *  in total and per year. All-time (since inception), independent of the window. */
export function ContributionBreakdown({
  points,
  income,
  currency,
}: {
  points: ValuePoint[]
  income: IncomeEvent[]
  currency: string
}) {
  const d = decomposeContributions(points, income)
  if (!d) return <p className="text-sm text-muted">Not enough history yet to attribute returns.</p>

  const sharePct = d.marketShare != null ? Math.round(d.marketShare * 100) : null
  const normalSplit = sharePct != null && d.marketGain >= 0 && d.contributions >= 0

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Invested capital">
          <Money value={d.contributions} currency={currency} />
        </Stat>
        <Stat label="Price return">
          <span className={d.priceGain >= 0 ? 'text-positive' : 'text-negative'}>
            <Money value={d.priceGain} currency={currency} />
          </span>
        </Stat>
        <Stat
          label="Income"
          info={
            <InfoPopover label="Income">
              <span className="block">
                Cash paid out by holdings without selling them: dividends from equities and funds,
                and interest. Measured net of withholding tax.
              </span>
              <span className="mt-1.5 block">
                Excludes price appreciation, proceeds realized from sales, and contributed capital,
                each of which is accounted for separately.
              </span>
            </InfoPopover>
          }
        >
          <Money value={d.income} currency={currency} />
        </Stat>
        <Stat label="Current value">
          <Money value={d.endValue} currency={currency} />
        </Stat>
      </div>

      {normalSplit ? (
        <p className="text-xs text-muted">
          Market return (price plus income) accounts for {sharePct}% of current value; contributed
          capital the remaining {100 - (sharePct as number)}%.
        </p>
      ) : sharePct != null ? (
        <p className="text-xs text-muted">
          Market return (price plus income) equals {sharePct}% of current value.
        </p>
      ) : null}

      <div className="h-72">
        <ContributionChart periods={d.periods} currency={currency} />
      </div>

      <p className="text-xs text-faint">
        Since inception, independent of the window above. Each year splits the change in value into
        net contributions, price return, and income (dividends and interest). Price return is the
        residual: value minus contributed capital minus income, so it also absorbs fees.
      </p>
    </div>
  )
}

function Stat({
  label,
  info,
  children,
}: {
  label: string
  info?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-faint">
        {label}
        {info}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{children}</p>
    </div>
  )
}
