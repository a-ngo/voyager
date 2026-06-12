import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getXray } from '@/lib/portfolio/xray'
import { pricesRateLimiter } from '@/lib/prices/rate-limiter'

/**
 * GET /api/portfolio/xray
 * Look-through analysis (sectors, countries, currency, top holdings, overlap).
 * Rate-limited — it fans out to many Yahoo `quoteSummary` lookups.
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
    return NextResponse.json(await getXray(user.id))
  } catch {
    return NextResponse.json({ error: 'Failed to load X-Ray' }, { status: 500 })
  }
}
