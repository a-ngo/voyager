import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { perMinuteLimiter } from '@/lib/prices/rate-limiter'
import { getPersonalNews } from '@/lib/news/personal'
import { MODEL_REGISTRY, DEFAULT_MODEL_ID, type ModelId } from '@/lib/ai/models'

/** GET /api/news/personal?model=<id> — portfolio-ranked news (cached per user+model). */
const limiter = perMinuteLimiter(10)

export async function GET(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!limiter.take(user.id).allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const requested = new URL(req.url).searchParams.get('model')
  const modelId: ModelId =
    requested && requested in MODEL_REGISTRY ? (requested as ModelId) : DEFAULT_MODEL_ID

  try {
    return NextResponse.json(await getPersonalNews(user.id, modelId))
  } catch {
    return NextResponse.json({ error: 'Failed to load personalized news' }, { status: 500 })
  }
}
