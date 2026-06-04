import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { setTargetAllocations } from '@/lib/db/transactions'

const bodySchema = z.object({
  targets: z.record(
    z.enum(['stock', 'etf', 'bond', 'crypto', 'cash']),
    z.number().min(0).max(100),
  ),
})

/** PUT /api/portfolio/targets — save target allocation weights for the signed-in user. */
export async function PUT(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid targets' }, { status: 400 })
  }

  try {
    await setTargetAllocations(user.id, parsed.data.targets)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to save targets' }, { status: 500 })
  }
}
