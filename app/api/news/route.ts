import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { perMinuteLimiter } from '@/lib/prices/rate-limiter'
import { getGeneralNews } from '@/lib/news/general'

/** GET /api/news — general financial news (cached server-side). */
const newsRateLimiter = perMinuteLimiter(20)

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!newsRateLimiter.take(user.id).allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  try {
    return NextResponse.json(await getGeneralNews())
  } catch {
    return NextResponse.json({ error: 'Failed to load news' }, { status: 500 })
  }
}
