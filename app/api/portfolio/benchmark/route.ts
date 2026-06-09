import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getBenchmarkSeries } from '@/lib/portfolio/benchmark-series'
import { pricesRateLimiter } from '@/lib/prices/rate-limiter'

const QuerySchema = z.object({ id: z.string().min(1).max(64) })

/**
 * GET /api/portfolio/benchmark?id=<benchmark>
 * Alternative-reality series: the user's contributions replayed into the chosen
 * benchmark basket. Rate-limited (triggers price-history lookups).
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
    id: new URL(request.url).searchParams.get('id'),
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid benchmark' }, { status: 400 })
  }

  try {
    const series = await getBenchmarkSeries(user.id, parsed.data.id)
    if (!series) {
      return NextResponse.json({ error: 'Unknown benchmark' }, { status: 404 })
    }
    return NextResponse.json(series)
  } catch {
    return NextResponse.json({ error: 'Failed to load benchmark' }, { status: 500 })
  }
}
