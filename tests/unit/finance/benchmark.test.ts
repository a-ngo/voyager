import { describe, expect, it } from 'vitest'
import { BENCHMARKS, getBenchmark, replayBenchmark } from '@/lib/finance/benchmark'

describe('replayBenchmark', () => {
  it('replays a contribution into a single component and values it forward', () => {
    const out = replayBenchmark(
      [{ date: '2024-01-01', amount: 1000 }],
      [{ weight: 1, points: [{ date: '2024-01-01', close: 100 }, { date: '2024-02-01', close: 110 }] }],
      ['2024-01-01', '2024-02-01'],
    )
    expect(out[0]).toEqual({ date: '2024-01-01', benchmark: 1000 }) // 10 units @ 100
    expect(out[1]).toEqual({ date: '2024-02-01', benchmark: 1100 }) // 10 units @ 110
  })

  it('splits a contribution across a weighted basket', () => {
    const a = { weight: 0.7, points: [{ date: '2024-01-01', close: 100 }, { date: '2024-02-01', close: 100 }] }
    const b = { weight: 0.3, points: [{ date: '2024-01-01', close: 50 }, { date: '2024-02-01', close: 100 }] }
    const out = replayBenchmark([{ date: '2024-01-01', amount: 1000 }], [a, b], ['2024-01-01', '2024-02-01'])
    // A: 700/100 = 7 units; B: 300/50 = 6 units
    expect(out[0]?.benchmark).toBeCloseTo(1000) // 7*100 + 6*50
    expect(out[1]?.benchmark).toBeCloseTo(1300) // 7*100 + 6*100
  })

  it('accumulates multiple contributions and forward-fills prices', () => {
    const out = replayBenchmark(
      [
        { date: '2024-01-01', amount: 1000 }, // 10 units @ 100
        { date: '2024-03-01', amount: 600 }, // 5 units @ 120
      ],
      [{ weight: 1, points: [
        { date: '2024-01-01', close: 100 },
        { date: '2024-03-01', close: 120 },
      ] }],
      ['2024-02-01', '2024-03-01'],
    )
    expect(out[0]?.benchmark).toBeCloseTo(1000) // Feb: 10 units, price forward-filled to 100
    expect(out[1]?.benchmark).toBeCloseTo(1800) // Mar: 15 units @ 120
  })

  it('back-fills contributions made before history starts at the earliest price', () => {
    const out = replayBenchmark(
      [{ date: '2023-06-01', amount: 1000 }], // before series → buys at first known price
      [{ weight: 1, points: [{ date: '2024-01-01', close: 100 }, { date: '2024-02-01', close: 120 }] }],
      ['2024-01-01', '2024-02-01'],
    )
    expect(out[0]?.benchmark).toBeCloseTo(1000) // 10 units @ 100 (back-filled), valued @ 100
    expect(out[1]?.benchmark).toBeCloseTo(1200) // 10 units @ 120
  })

  it('handles a withdrawal as a negative contribution (units sold)', () => {
    const points = [{ date: '2024-01-01', close: 100 }, { date: '2024-02-01', close: 100 }]
    const out = replayBenchmark(
      [
        { date: '2024-01-01', amount: 1000 }, // +10 units
        { date: '2024-02-01', amount: -200 }, // −2 units
      ],
      [{ weight: 1, points }],
      ['2024-02-01'],
    )
    expect(out[0]?.benchmark).toBeCloseTo(800) // 8 units @ 100
  })
})

describe('BENCHMARKS', () => {
  it('each benchmark weights sum to 1', () => {
    for (const b of BENCHMARKS) {
      const sum = b.components.reduce((s, c) => s + c.weight, 0)
      expect(sum).toBeCloseTo(1)
    }
  })

  it('getBenchmark resolves by id and returns undefined otherwise', () => {
    expect(getBenchmark('msci-acwi')?.label).toBe('MSCI All-World')
    expect(getBenchmark('nope')).toBeUndefined()
  })
})
