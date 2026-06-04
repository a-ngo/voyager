import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPerformanceSeries } from '@/lib/portfolio/performance-series'
import { pricesRateLimiter } from '@/lib/prices/rate-limiter'

/**
 * GET /api/portfolio/performance
 * Portfolio value vs. net invested over time. Rate-limited (triggers history
 * lookups).
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!pricesRateLimiter.take(user.id).allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    return NextResponse.json(await getPerformanceSeries(user.id))
  } catch {
    return NextResponse.json({ error: 'Failed to load performance' }, { status: 500 })
  }
}
