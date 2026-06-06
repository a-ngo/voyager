import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deleteUserPortfolioData } from '@/lib/db/transactions'

/**
 * DELETE /api/portfolio
 * Wipes the signed-in user's transactions + portfolio so they can re-import
 * from scratch. Shared market data is untouched.
 */
export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await deleteUserPortfolioData(user.id)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Failed to delete portfolio' }, { status: 500 })
  }
}
