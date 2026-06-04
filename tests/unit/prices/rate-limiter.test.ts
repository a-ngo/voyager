import { describe, expect, it } from 'vitest'
import { TokenBucketLimiter, perMinuteLimiter } from '@/lib/prices/rate-limiter'

describe('TokenBucketLimiter', () => {
  it('allows up to capacity, then denies', () => {
    const rl = perMinuteLimiter(3)
    const t = 1_000_000
    expect(rl.take('u', t).allowed).toBe(true)
    expect(rl.take('u', t).allowed).toBe(true)
    expect(rl.take('u', t).allowed).toBe(true)
    const denied = rl.take('u', t)
    expect(denied.allowed).toBe(false)
    expect(denied.retryAfterMs).toBeGreaterThan(0)
  })

  it('refills over time', () => {
    const rl = perMinuteLimiter(60) // 1 token/sec
    const t = 1_000_000
    for (let i = 0; i < 60; i++) rl.take('u', t)
    expect(rl.take('u', t).allowed).toBe(false)
    // 2 seconds later → ~2 tokens back
    expect(rl.take('u', t + 2000).allowed).toBe(true)
  })

  it('tracks keys independently', () => {
    const rl = perMinuteLimiter(1)
    const t = 1_000_000
    expect(rl.take('a', t).allowed).toBe(true)
    expect(rl.take('a', t).allowed).toBe(false)
    expect(rl.take('b', t).allowed).toBe(true) // separate bucket
  })

  it('never exceeds capacity when idle a long time', () => {
    const rl = new TokenBucketLimiter(5, 5 / 60_000)
    const r = rl.take('u', 10_000_000) // first use far in the future
    expect(r.remaining).toBe(4) // started full at capacity, not more
  })
})
