import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getConversationMessages, deleteConversation } from '@/lib/db/ai-conversations'

/** GET /api/ai/conversations/[id] — full message history for one conversation. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  try {
    const messages = await getConversationMessages(user.id, id)
    if (messages === null) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ messages })
  } catch {
    return NextResponse.json({ error: 'Failed to load conversation' }, { status: 500 })
  }
}

/** DELETE /api/ai/conversations/[id] */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  try {
    await deleteConversation(user.id, id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 })
  }
}
