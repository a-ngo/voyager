import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDashboardSummary } from '@/lib/portfolio/valued-overview'
import { pricesRateLimiter } from '@/lib/prices/rate-limiter'

/**
 * GET /api/portfolio/summary
 * Dashboard KPIs + allocation for the signed-in user. Rate-limited because it
 * triggers price/resolution lookups.
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
    const summary = await getDashboardSummary(user.id)
    return NextResponse.json(summary)
  } catch {
    return NextResponse.json({ error: 'Failed to load portfolio' }, { status: 500 })
  }
}
