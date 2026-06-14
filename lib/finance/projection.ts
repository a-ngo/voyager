/**
 * Forward value projection (pure). Compounds an initial value plus fixed monthly
 * contributions at a constant annual rate, monthly. Deterministic — this is the
 * scenario projector behind the Projections page (Monte Carlo would be separate).
 */

export interface ProjectionInput {
  /** Starting portfolio value. */
  initial: number
  /** Contribution added at the end of each month. */
  monthlyContribution: number
  /** Annual return, in percent (e.g. 7 = 7%/yr). May be 0 or negative. */
  annualRatePct: number
  /** Horizon in whole years. */
  years: number
}

export interface ProjectionPoint {
  year: number
  /** Projected portfolio value at year end. */
  value: number
  /** Principal in: initial + cumulative contributions (no growth). */
  invested: number
}

export interface ProjectionResult {
  points: ProjectionPoint[]
  finalValue: number
  totalInvested: number
  /** finalValue − totalInvested: the compounding gain. */
  totalGrowth: number
}

export function project({
  initial,
  monthlyContribution,
  annualRatePct,
  years,
}: ProjectionInput): ProjectionResult {
  // Effective monthly rate so 12 months compound to exactly the annual rate.
  const monthly = Math.pow(1 + annualRatePct / 100, 1 / 12) - 1
  const months = Math.max(0, Math.round(years * 12))

  const points: ProjectionPoint[] = [{ year: 0, value: initial, invested: initial }]
  let value = initial
  for (let m = 1; m <= months; m++) {
    value = value * (1 + monthly) + monthlyContribution
    if (m % 12 === 0) {
      points.push({ year: m / 12, value, invested: initial + monthlyContribution * m })
    }
  }

  const totalInvested = initial + monthlyContribution * months
  return { points, finalValue: value, totalInvested, totalGrowth: value - totalInvested }
}

/**
 * Years until the projection first reaches `target` (rounded to 0.1y), or null
 * if not reached within `maxYears`. Returns 0 if already at/above target.
 */
export function yearsToReach(
  input: Omit<ProjectionInput, 'years'> & { target: number },
  maxYears = 100,
): number | null {
  const { initial, monthlyContribution, annualRatePct, target } = input
  if (target <= initial) return 0
  const monthly = Math.pow(1 + annualRatePct / 100, 1 / 12) - 1
  let value = initial
  for (let m = 1; m <= maxYears * 12; m++) {
    value = value * (1 + monthly) + monthlyContribution
    if (value >= target) return Math.round((m / 12) * 10) / 10
  }
  return null
}
