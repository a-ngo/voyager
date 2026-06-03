import { NextResponse } from 'next/server'
import { importTradeRepublicCsv, type PersistTransaction } from '@/lib/import/trade-republic/importer'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

/**
 * POST /api/import/trade-republic
 * Accepts a multipart CSV upload, strips PII, maps to Voyager transactions,
 * and returns an ImportResult summary. The CSV is processed entirely
 * server-side and never logged.
 *
 * TODO(phase-1): wire Supabase auth + Drizzle upsert:
 *   - verify session, scope to session.user.id
 *   - persist via onConflictDoNothing on (user_id, broker, external_id)
 *   - trigger async ISIN→ticker resolution (OpenFIGI)
 * Until then `persist` reports every prepared row as inserted so the import
 * flow is exercisable end-to-end without a database.
 */
export async function POST(request: Request) {
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

  // Skeleton persist: no DB yet. Real impl upserts with onConflictDoNothing.
  const persist: PersistTransaction = async () => 'inserted'

  try {
    const result = await importTradeRepublicCsv(csvText, persist)
    return NextResponse.json(result)
  } catch {
    // Never leak internal details or row data to the client.
    return NextResponse.json({ error: 'Failed to process import' }, { status: 500 })
  }
}
