import { NextResponse } from 'next/server'
import { importTradeRepublicCsv } from '@/lib/import/trade-republic/importer'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateDefaultPortfolio, makePersist } from '@/lib/db/transactions'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

/**
 * POST /api/import/trade-republic
 * Accepts a multipart CSV upload, strips PII, maps to Voyager transactions,
 * and upserts them for the signed-in user. The CSV is processed entirely
 * server-side and never logged.
 *
 * TODO(phase-1): trigger async ISIN→ticker resolution (OpenFIGI) after import.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File exceeds 5MB limit' }, { status: 413 })
  }

  if (file.name && !file.name.toLowerCase().endsWith('.csv')) {
    return NextResponse.json({ error: 'Only .csv files are accepted' }, { status: 400 })
  }

  const csvText = await file.text()

  try {
    const portfolioId = await getOrCreateDefaultPortfolio(user.id)
    const persist = makePersist(user.id, portfolioId)
    const result = await importTradeRepublicCsv(csvText, persist)
    return NextResponse.json(result)
  } catch {
    // Never leak internal details or row data to the client.
    return NextResponse.json({ error: 'Failed to process import' }, { status: 500 })
  }
}
