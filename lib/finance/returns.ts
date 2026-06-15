/**
 * Time-weighted (TWR) and money-weighted (MWR/IRR) returns. Pure functions over
 * a dated value series and dated cashflows. TWR neutralizes contribution timing
 * (compares against a benchmark fairly); MWR is the investor's actual IRR.
 */

function daysBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / 86_400_000
}

export interface ValuePoint {
  date: string
  value: number
  /** Cumulative net contributions (deposits − withdrawals) up to this date. */
  invested: number
}

export interface ReturnResult {
  /** Total return over the whole span, as a fraction (0.21 = +21%). */
  cumulative: number
  /** Annualized (CAGR-equivalent) fraction. */
  annualized: number
}

/**
 * Time-weighted return: geometrically chain each period's growth, neutralizing
 * cashflows. Each period's net contribution is assumed to enter at the period
 * start (reasonable for monthly points). Periods with no capital at risk are
 * skipped. Needs ≥2 points; null otherwise.
 */
export function timeWeightedReturn(points: ValuePoint[]): ReturnResult | null {
  if (points.length < 2) return null

  let growth = 1
  let counted = 0
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!
    const cur = points[i]!
    const flow = cur.invested - prev.invested
    const base = prev.value + flow
    if (base <= 0) continue
    growth *= cur.value / base
    counted += 1
  }
  if (counted === 0) return null

  const cumulative = growth - 1
  const days = daysBetween(points[0]!.date, points[points.length - 1]!.date)
  const annualized = days > 0 ? Math.pow(growth, 365 / days) - 1 : cumulative
  return { cumulative, annualized }
}

export interface RiskResult {
  /** Annualized standard deviation of periodic returns (fraction). */
  volatility: number
  /** Worst peak-to-trough decline of the contribution-neutral growth index (fraction, ≥0). */
  maxDrawdown: number
  /** (annualized TWR − risk-free) / annualized volatility; null when volatility is 0. */
  sharpe: number | null
}

/**
 * Risk metrics over a dated value series, using the same contribution-neutral
 * period growth as TWR (so deposits don't masquerade as gains or drawdowns):
 * volatility (annualized stdev of period returns), max drawdown (on the chained
 * growth index), and Sharpe (annualized TWR over annualized volatility). Needs
 * ≥3 points (≥2 usable periods); null otherwise.
 */
export function riskMetrics(points: ValuePoint[], riskFreeRate = 0.02): RiskResult | null {
  if (points.length < 3) return null

  const returns: number[] = []
  let index = 1
  let peak = 1
  let maxDrawdown = 0
  let totalDays = 0
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!
    const cur = points[i]!
    const flow = cur.invested - prev.invested
    const base = prev.value + flow
    if (base <= 0) continue
    const g = cur.value / base
    returns.push(g - 1)
    index *= g
    peak = Math.max(peak, index)
    maxDrawdown = Math.max(maxDrawdown, (peak - index) / peak)
    totalDays += daysBetween(prev.date, cur.date)
  }
  if (returns.length < 2) return null

  const mean = returns.reduce((s, r) => s + r, 0) / returns.length
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1)
  const periodsPerYear = totalDays > 0 ? (365 * returns.length) / totalDays : 12
  const volatility = Math.sqrt(variance) * Math.sqrt(periodsPerYear)

  const span = daysBetween(points[0]!.date, points[points.length - 1]!.date)
  const annualized = span > 0 ? Math.pow(index, 365 / span) - 1 : index - 1
  const sharpe = volatility > 0 ? (annualized - riskFreeRate) / volatility : null

  return { volatility, maxDrawdown, sharpe }
}

/** A dated cashflow from the investor's view: negative = invested, positive = received. */
export interface CashFlow {
  date: string
  amount: number
}

function npv(flows: CashFlow[], rate: number, t0: string): number {
  return flows.reduce(
    (sum, f) => sum + f.amount / Math.pow(1 + rate, daysBetween(t0, f.date) / 365),
    0,
  )
}

/**
 * Money-weighted return (annualized IRR) over dated cashflows. Solved by
 * bisection. Returns null when the flows don't bracket a root (e.g. all the same
 * sign) or there are too few.
 */
export function moneyWeightedReturn(flows: CashFlow[]): number | null {
  if (flows.length < 2) return null

  const t0 = flows[0]!.date
  let lo = -0.9999
  let hi = 10
  let fLo = npv(flows, lo, t0)
  let fHi = npv(flows, hi, t0)
  if (fLo === 0) return lo
  if (fHi === 0) return hi
  if (fLo * fHi > 0) return null // no sign change to bracket

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    const fMid = npv(flows, mid, t0)
    if (Math.abs(fMid) < 1e-7 || (hi - lo) / 2 < 1e-8) return mid
    if (fLo * fMid < 0) {
      hi = mid
      fHi = fMid
    } else {
      lo = mid
      fLo = fMid
    }
  }
  return (lo + hi) / 2
}

/**
 * Build IRR cashflows from a value series: buy in at the first point's value,
 * each period's net contribution is a further investment (or withdrawal), and
 * the final value is received at the end. Investments negative, receipts
 * positive.
 */
export function cashflowsFromSeries(points: ValuePoint[]): CashFlow[] {
  if (points.length < 2) return []
  const flows: CashFlow[] = [{ date: points[0]!.date, amount: -points[0]!.value }]
  for (let i = 1; i < points.length; i++) {
    const flow = points[i]!.invested - points[i - 1]!.invested
    if (Math.abs(flow) > 1e-9) flows.push({ date: points[i]!.date, amount: -flow })
  }
  flows.push({ date: points[points.length - 1]!.date, amount: points[points.length - 1]!.value })
  return flows
}
