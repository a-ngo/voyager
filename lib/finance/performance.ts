import { reconstructPortfolio, type LedgerTransaction } from './holdings'
import { toEur } from '@/lib/prices/fx'

/**
 * Portfolio value over time. Pure: reconstruct holdings at each sample date from
 * the ledger, value them against a historical price series, add cash. The line
 * to compare against is net contributions (money put in) — the gap is gains.
 *
 * Historical FX uses the rates passed in (current rates in v1 — a documented
 * approximation; per-date FX is a later refinement).
 */

export interface PricePoint {
  date: string // YYYY-MM-DD
  close: number // native currency
}

export interface InstrumentSeries {
  isin: string
  currency: string
  points: PricePoint[] // ascending by date
}

export interface PerfPoint {
  date: string
  value: number // EUR
  invested: number // EUR, net contributions to date
}

/** Most recent close at or before `date` (forward-fill). */
function priceAt(points: PricePoint[], date: string): number | null {
  let close: number | null = null
  for (const p of points) {
    if (p.date <= date) close = p.close
    else break
  }
  return close
}

export function valueOverTime(
  ledger: LedgerTransaction[],
  series: InstrumentSeries[],
  dates: string[],
  rates: Record<string, number>,
): PerfPoint[] {
  const byIsin = new Map(series.map((s) => [s.isin, s]))

  return dates.map((date) => {
    const summary = reconstructPortfolio(ledger.filter((t) => t.date <= date))
    let value = summary.cash

    for (const pos of summary.positions) {
      const s = pos.isin ? byIsin.get(pos.isin) : undefined
      if (!s) continue
      const close = priceAt(s.points, date)
      if (close == null) continue
      const eur = toEur(close * pos.quantity, s.currency, rates)
      if (eur != null) value += eur
    }

    return { date, value, invested: summary.netContributions }
  })
}

/** Month-end sample dates from `firstDate`'s month through `today` (today for the current month). */
export function monthlyDates(firstDate: string, today: string): string[] {
  const start = new Date(`${firstDate}T00:00:00Z`)
  const end = new Date(`${today}T00:00:00Z`)
  const out: string[] = []

  let year = start.getUTCFullYear()
  let month = start.getUTCMonth()
  while (year < end.getUTCFullYear() || (year === end.getUTCFullYear() && month <= end.getUTCMonth())) {
    const monthEnd = new Date(Date.UTC(year, month + 1, 0))
    const sample = monthEnd.getTime() <= end.getTime() ? monthEnd : end
    out.push(sample.toISOString().slice(0, 10))
    month += 1
    if (month > 11) {
      month = 0
      year += 1
    }
  }
  return out
}
