/**
 * Monte Carlo forward simulation (pure, seeded → deterministic and testable).
 * Each path draws monthly lognormal returns from an annual expected return and
 * volatility, adds the monthly contribution, and is sampled at year boundaries.
 * Output: per-year percentile bands (p10/p50/p90) and the probability of
 * reaching a target by the horizon. The heavy loop runs in a Web Worker (§10).
 */

export interface MonteCarloInput {
  initial: number
  monthlyContribution: number
  annualReturnPct: number
  annualVolatilityPct: number
  years: number
  target?: number | null
  simulations?: number
  seed?: number
}

export interface MonteCarloBand {
  year: number
  p10: number
  p50: number
  p90: number
  /** Principal in: initial + cumulative contributions (no growth). */
  invested: number
}

export interface MonteCarloResult {
  bands: MonteCarloBand[]
  /** Fraction of paths reaching the target by the horizon (0..1), or null. */
  probReachTarget: number | null
  simulations: number
}

/** mulberry32 — small, fast, seedable PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Standard-normal sampler (Box–Muller) over a seeded uniform source. */
function makeNormal(rng: () => number): () => number {
  return () => {
    let u = 0
    let v = 0
    while (u === 0) u = rng()
    while (v === 0) v = rng()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
}

/** Nearest-rank percentile of a sorted ascending array. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))))
  return sorted[idx]!
}

export function simulateMonteCarlo(input: MonteCarloInput): MonteCarloResult {
  const { initial, monthlyContribution, annualReturnPct, annualVolatilityPct } = input
  const years = Math.max(0, Math.round(input.years))
  const sims = Math.max(1, Math.min(20000, Math.round(input.simulations ?? 1000)))
  const target = input.target ?? null
  const months = years * 12

  const rng = mulberry32(input.seed ?? 0x9e3779b9)
  const normal = makeNormal(rng)

  // Annual → monthly lognormal parameters.
  const muMonthly = Math.log(1 + annualReturnPct / 100) / 12
  const sigmaMonthly = annualVolatilityPct / 100 / Math.sqrt(12)

  const yearValues: number[][] = Array.from({ length: years + 1 }, () => [])
  let reached = 0

  for (let s = 0; s < sims; s++) {
    let value = initial
    yearValues[0]!.push(value)
    for (let m = 1; m <= months; m++) {
      value = value * Math.exp(muMonthly + sigmaMonthly * normal()) + monthlyContribution
      if (m % 12 === 0) yearValues[m / 12]!.push(value)
    }
    if (target != null && value >= target) reached += 1
  }

  const bands: MonteCarloBand[] = yearValues.map((vals, year) => {
    const sorted = [...vals].sort((a, b) => a - b)
    return {
      year,
      p10: percentile(sorted, 10),
      p50: percentile(sorted, 50),
      p90: percentile(sorted, 90),
      invested: initial + monthlyContribution * year * 12,
    }
  })

  return { bands, probReachTarget: target != null ? reached / sims : null, simulations: sims }
}
