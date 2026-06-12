import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { fetchInstrumentDetail } from '@/lib/prices/yahoo-fundamentals'
import { pricesRateLimiter } from '@/lib/prices/rate-limiter'

const QuerySchema = z.object({ symbol: z.string().min(1).max(32) })

/**
 * GET /api/instrument?symbol=<yahoo-symbol>
 * Fundamentals + analyst data for one instrument. Auth-gated + rate-limited.
 */
export async function GET(request: Request) {
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

  const parsed = QuerySchema.safeParse({
    symbol: new URL(request.url).searchParams.get('symbol'),
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 })
  }

  try {
    const detail = await fetchInstrumentDetail(parsed.data.symbol)
    if (!detail) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(detail)
  } catch {
    return NextResponse.json({ error: 'Failed to load instrument' }, { status: 500 })
  }
}
