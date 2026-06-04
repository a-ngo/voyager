import { describe, expect, it } from 'vitest'
import { buildTargetComparison } from '@/lib/portfolio/targets'

const current = [
  { bucket: 'etf' as const, weight: 70, color: '#6f94a6' },
  { bucket: 'stock' as const, weight: 30, color: '#c2613f' },
]

describe('buildTargetComparison', () => {
  it('computes signed drift per bucket', () => {
    const rows = buildTargetComparison(current, { etf: 60, stock: 40 })
    const etf = rows.find((r) => r.bucket === 'etf')
    expect(etf?.current).toBe(70)
    expect(etf?.target).toBe(60)
    expect(etf?.drift).toBeCloseTo(10)
    const stock = rows.find((r) => r.bucket === 'stock')
    expect(stock?.drift).toBeCloseTo(-10)
  })

  it('orders buckets consistently (stock before etf)', () => {
    const rows = buildTargetComparison(current, { etf: 60, stock: 40 })
    expect(rows[0]?.bucket).toBe('stock')
    expect(rows[1]?.bucket).toBe('etf')
  })

  it('includes a target-only bucket the user does not hold yet', () => {
    const rows = buildTargetComparison(current, { etf: 50, stock: 30, bond: 20 })
    const bond = rows.find((r) => r.bucket === 'bond')
    expect(bond).toBeDefined()
    expect(bond?.current).toBe(0)
    expect(bond?.target).toBe(20)
    expect(bond?.drift).toBeCloseTo(-20)
  })

  it('omits buckets with neither holding nor target', () => {
    const rows = buildTargetComparison(current, { etf: 100 })
    expect(rows.some((r) => r.bucket === 'crypto')).toBe(false)
  })

  it('falls back to the bucket color when not in the current slice', () => {
    const rows = buildTargetComparison([], { bond: 20 })
    expect(rows[0]?.color).toBe('#d2a052')
  })
})
