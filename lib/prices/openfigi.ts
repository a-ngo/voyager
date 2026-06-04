import 'server-only'
import { selectCandidates, type FigiItem, type SymbolCandidate } from './figi-select'

export type { SymbolCandidate }

/**
 * ISIN → candidate Stooq symbols via OpenFIGI (free; optional OPENFIGI_API_KEY
 * raises rate limits). Selection logic is pure and lives in figi-select.ts.
 */
export async function openFigiCandidates(isin: string): Promise<SymbolCandidate[]> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const key = process.env.OPENFIGI_API_KEY
    if (key) headers['X-OPENFIGI-APIKEY'] = key

    const res = await fetch('https://api.openfigi.com/v3/mapping', {
      method: 'POST',
      headers,
      body: JSON.stringify([{ idType: 'ID_ISIN', idValue: isin }]),
    })
    if (!res.ok) return []

    const json = (await res.json()) as Array<{ data?: FigiItem[] }>
    const data = json[0]?.data
    return Array.isArray(data) ? selectCandidates(isin, data) : []
  } catch {
    return []
  }
}
