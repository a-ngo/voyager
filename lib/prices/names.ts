import 'server-only'
import { inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { isinTickerMap } from '@/lib/db/schema'

/**
 * Instrument names resolved from `isin_ticker_map` (populated from the price
 * source). Returns a map of ISIN → name; ISINs without a stored name are
 * absent and fall back to the curated map / ISIN at display time.
 */
export async function getInstrumentNames(isins: (string | null)[]): Promise<Record<string, string>> {
  const unique = [...new Set(isins.filter((i): i is string => !!i))]
  if (unique.length === 0) return {}

  const db = getDb()
  const rows = await db
    .select({ isin: isinTickerMap.isin, name: isinTickerMap.name })
    .from(isinTickerMap)
    .where(inArray(isinTickerMap.isin, unique))

  const map: Record<string, string> = {}
  for (const r of rows) if (r.name) map[r.isin] = r.name
  return map
}
