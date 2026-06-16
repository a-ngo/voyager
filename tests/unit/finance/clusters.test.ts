import { describe, it, expect } from 'vitest'
import {
  clusterPerformance,
  type ClusterDef,
  type ClusterInstrument,
} from '@/lib/finance/clusters'

const clusters: ClusterDef[] = [
  { id: 'core', name: 'Core', color: '#1' },
  { id: 'sat', name: 'Satellite', color: '#2' },
]

const instruments: ClusterInstrument[] = [
  { key: 'A', marketValue: 1200, costBasis: 1000, unrealizedPnl: 200, realizedPnl: 0, income: 30, invested: 1000 },
  { key: 'B', marketValue: 0, costBasis: 0, unrealizedPnl: 0, realizedPnl: -150, income: 0, invested: 500 }, // closed at a loss
  { key: 'C', marketValue: 800, costBasis: 900, unrealizedPnl: -100, realizedPnl: 0, income: 0, invested: 900 },
]

describe('clusterPerformance', () => {
  it('aggregates assigned instruments and computes returns', () => {
    const assignments = { A: 'core', B: 'sat', C: 'sat' }
    const { clusters: out, unassigned } = clusterPerformance(clusters, assignments, instruments)

    const core = out.find((c) => c.id === 'core')!
    expect(core.count).toBe(1)
    expect(core.totalPnl).toBe(230) // 200 unrealized + 0 realized + 30 income
    expect(core.returnPct).toBeCloseTo(23, 6) // 230 / 1000

    const sat = out.find((c) => c.id === 'sat')!
    expect(sat.count).toBe(2)
    expect(sat.realizedPnl).toBe(-150)
    expect(sat.totalPnl).toBe(-250) // -100 unrealized + -150 realized
    expect(sat.invested).toBe(1400)
    expect(sat.returnPct).toBeCloseTo((-250 / 1400) * 100, 6)

    expect(unassigned.count).toBe(0)
  })

  it('routes unknown or missing assignments to Unassigned', () => {
    const assignments = { A: 'core', B: 'nonexistent' } // C unassigned entirely
    const { clusters: out, unassigned } = clusterPerformance(clusters, assignments, instruments)

    expect(out.find((c) => c.id === 'core')!.count).toBe(1)
    expect(out.find((c) => c.id === 'sat')!.count).toBe(0)
    expect(unassigned.count).toBe(2) // B (unknown cluster) + C (no assignment)
    expect(unassigned.keys.sort()).toEqual(['B', 'C'])
  })

  it('returns null return% for a cluster with nothing invested', () => {
    const { clusters: out } = clusterPerformance(clusters, {}, [])
    expect(out.every((c) => c.returnPct === null)).toBe(true)
    expect(out.every((c) => c.totalPnl === 0)).toBe(true)
  })

  it('treats unpriced (null marketValue) holdings as zero in sums', () => {
    const insts: ClusterInstrument[] = [
      { key: 'X', marketValue: null, costBasis: 500, unrealizedPnl: null, realizedPnl: 0, income: 10, invested: 500 },
    ]
    const { clusters: out } = clusterPerformance(clusters, { X: 'core' }, insts)
    const core = out.find((c) => c.id === 'core')!
    expect(core.marketValue).toBe(0)
    expect(core.totalPnl).toBe(10) // only income counts
  })
})
