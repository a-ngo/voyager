/**
 * Token-bucket rate limiter for the price/AI endpoints.
 * Pure logic: `now` is injectable so it's deterministic to test.
 *
 * Caveat: state is in-memory per server instance. On serverless (Vercel) each
 * instance has its own buckets, so this caps per-instance, not globally. Good
 * enough to blunt abuse from a single client; a distributed cap (Upstash/Redis)
 * is the production upgrade when the app goes public.
 */

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

interface Bucket {
  tokens: number
  last: number
}

export class TokenBucketLimiter {
  private readonly buckets = new Map<string, Bucket>()

  constructor(
    private readonly capacity: number,
    private readonly refillPerMs: number,
  ) {}

  /** Attempt to consume one token for `key`. */
  take(key: string, now: number = Date.now()): RateLimitResult {
    const b = this.buckets.get(key) ?? { tokens: this.capacity, last: now }
    b.tokens = Math.min(this.capacity, b.tokens + (now - b.last) * this.refillPerMs)
    b.last = now

    if (b.tokens >= 1) {
      b.tokens -= 1
      this.buckets.set(key, b)
      return { allowed: true, remaining: Math.floor(b.tokens), retryAfterMs: 0 }
    }

    this.buckets.set(key, b)
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.ceil((1 - b.tokens) / this.refillPerMs),
    }
  }
}

/** Limiter that refills to `maxPerMinute` tokens over each minute. */
export function perMinuteLimiter(maxPerMinute: number): TokenBucketLimiter {
  return new TokenBucketLimiter(maxPerMinute, maxPerMinute / 60_000)
}

/** Shared limiter for the price endpoint: 30 requests/min per user. */
export const pricesRateLimiter = perMinuteLimiter(30)
