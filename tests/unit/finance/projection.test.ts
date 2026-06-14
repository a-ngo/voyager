import { describe, it, expect } from 'vitest'
import { project, yearsToReach } from '@/lib/finance/projection'

describe('project', () => {
  it('compounds a lump sum to exactly the annual rate (no contributions)', () => {
    const r = project({ initial: 1000, monthlyContribution: 0, annualRatePct: 10, years: 1 })
    expect(r.finalValue).toBeCloseTo(1100, 6) // monthly effective rate compounds to 10%/yr
    expect(r.totalInvested).toBe(1000)
    expect(r.totalGrowth).toBeCloseTo(100, 6)
  })

  it('is pure contributions at 0% (no growth)', () => {
    const r = project({ initial: 0, monthlyContribution: 100, annualRatePct: 0, years: 1 })
    expect(r.finalValue).toBeCloseTo(1200, 6)
    expect(r.totalInvested).toBe(1200)
    expect(r.totalGrowth).toBeCloseTo(0, 6)
  })

  it('emits one point per year plus year 0', () => {
    const r = project({ initial: 500, monthlyContribution: 50, annualRatePct: 5, years: 10 })
    expect(r.points).toHaveLength(11)
    expect(r.points[0]).toEqual({ year: 0, value: 500, invested: 500 })
    expect(r.points[10]?.year).toBe(10)
    expect(r.points[10]?.invested).toBe(500 + 50 * 120)
  })

  it('grows with contributions + compounding (growth exceeds 0)', () => {
    const r = project({ initial: 10000, monthlyContribution: 500, annualRatePct: 7, years: 20 })
    expect(r.totalInvested).toBe(10000 + 500 * 240)
    expect(r.finalValue).toBeGreaterThan(r.totalInvested)
    expect(r.totalGrowth).toBeCloseTo(r.finalValue - r.totalInvested, 6)
  })

  it('handles a negative rate (drawdown)', () => {
    const r = project({ initial: 1000, monthlyContribution: 0, annualRatePct: -10, years: 1 })
    expect(r.finalValue).toBeCloseTo(900, 6)
  })
})

describe('yearsToReach', () => {
  it('returns 0 when already at or above target', () => {
    expect(yearsToReach({ initial: 5000, monthlyContribution: 0, annualRatePct: 5, target: 4000 })).toBe(0)
  })

  it('finds the crossing with pure contributions', () => {
    expect(yearsToReach({ initial: 0, monthlyContribution: 100, annualRatePct: 0, target: 1200 })).toBe(1)
    expect(yearsToReach({ initial: 0, monthlyContribution: 100, annualRatePct: 0, target: 600 })).toBe(0.5)
  })

  it('finds the crossing with compounding', () => {
    expect(yearsToReach({ initial: 1000, monthlyContribution: 0, annualRatePct: 10, target: 1100 })).toBe(1)
  })

  it('returns null when the target is unreachable in the horizon', () => {
    expect(yearsToReach({ initial: 1000, monthlyContribution: 0, annualRatePct: -5, target: 2000 })).toBeNull()
  })
})
