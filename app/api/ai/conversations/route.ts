import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listConversations } from '@/lib/db/ai-conversations'

/** GET /api/ai/conversations — the signed-in user's conversation summaries. */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return NextResponse.json(await listConversations(user.id))
  } catch {
    return NextResponse.json({ error: 'Failed to load conversations' }, { status: 500 })
  }
}
