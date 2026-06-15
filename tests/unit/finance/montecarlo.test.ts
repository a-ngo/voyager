import { describe, it, expect } from 'vitest'
import { simulateMonteCarlo } from '@/lib/finance/montecarlo'

const base = {
  initial: 10000,
  monthlyContribution: 500,
  annualReturnPct: 7,
  annualVolatilityPct: 15,
  years: 10,
  seed: 42,
}

describe('simulateMonteCarlo', () => {
  it('is deterministic for a given seed', () => {
    const a = simulateMonteCarlo(base)
    const b = simulateMonteCarlo(base)
    expect(a.bands).toEqual(b.bands)
    expect(a.bands).toHaveLength(11) // year 0..10
    expect(a.bands[0]).toMatchObject({ year: 0, p10: 10000, p50: 10000, p90: 10000 })
  })

  it('orders percentiles p10 ≤ p50 ≤ p90 and grows over time', () => {
    const r = simulateMonteCarlo(base)
    for (const band of r.bands) {
      expect(band.p10).toBeLessThanOrEqual(band.p50)
      expect(band.p50).toBeLessThanOrEqual(band.p90)
    }
    expect(r.bands.at(-1)!.p50).toBeGreaterThan(r.bands[0]!.p50)
  })

  it('collapses to the deterministic path at zero volatility', () => {
    const r = simulateMonteCarlo({ ...base, annualVolatilityPct: 0, simulations: 50 })
    const last = r.bands.at(-1)!
    expect(last.p10).toBeCloseTo(last.p50, 4)
    expect(last.p50).toBeCloseTo(last.p90, 4)
    expect(last.p50).toBeGreaterThan(last.invested) // 7% return beats contributions
  })

  it('reports probability of reaching a target', () => {
    const noVol = simulateMonteCarlo({ ...base, annualVolatilityPct: 0, target: 1000, simulations: 100 })
    expect(noVol.probReachTarget).toBe(1) // trivially reached
    const impossible = simulateMonteCarlo({ ...base, annualVolatilityPct: 0, target: 1e12, simulations: 100 })
    expect(impossible.probReachTarget).toBe(0)
    expect(simulateMonteCarlo({ ...base }).probReachTarget).toBeNull() // no target
  })

  it('gives a probability strictly between 0 and 1 for a plausible target', () => {
    const r = simulateMonteCarlo({ ...base, target: 110000, simulations: 2000 })
    expect(r.probReachTarget).toBeGreaterThan(0)
    expect(r.probReachTarget).toBeLessThan(1)
  })
})
