import { describe, expect, it } from 'vitest'
import { computeDrift } from '@/lib/finance/drift'

describe('computeDrift', () => {
  it('computes signed drift and flags breaches over the threshold', () => {
    const report = computeDrift(
      { equity: 0.7, bonds: 0.2, cash: 0.1 },
      { equity: 0.6, bonds: 0.3, cash: 0.1 },
      0.05,
    )

    const equity = report.items.find((i) => i.key === 'equity')
    expect(equity?.drift).toBeCloseTo(0.1)
    expect(equity?.breached).toBe(true)

    const cash = report.items.find((i) => i.key === 'cash')
    expect(cash?.drift).toBeCloseTo(0)
    expect(cash?.breached).toBe(false)

    expect(report.anyBreached).toBe(true)
    expect(report.maxAbsDrift).toBeCloseTo(0.1)
  })

  it('treats missing keys as zero weight', () => {
    const report = computeDrift({ equity: 1 }, { equity: 0.8, gold: 0.2 }, 0.05)
    const gold = report.items.find((i) => i.key === 'gold')
    expect(gold?.current).toBe(0)
    expect(gold?.target).toBe(0.2)
    expect(gold?.breached).toBe(true)
  })

  it('sorts items by absolute drift descending', () => {
    const report = computeDrift(
      { a: 0.5, b: 0.3, c: 0.2 },
      { a: 0.5, b: 0.1, c: 0.35 },
      0.05,
    )
    expect(report.items[0]?.key).toBe('b') // 0.2 abs drift, larger than c's 0.15
  })
})
