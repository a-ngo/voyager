import 'server-only'
import type { InstrumentProfile } from '@/lib/finance/xray'

/**
 * Yahoo `quoteSummary` fundamentals for portfolio X-Ray: ETF look-through
 * (top holdings + sector weights) and per-instrument profile (country, sector).
 * Unlike the chart endpoint, quoteSummary needs a cookie+crumb handshake; the
 * crumb is cached in module memory. Profiles are cached per symbol (they change
 * slowly). Keyless. Local-first (Yahoo 429s from Vercel IPs).
 */

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
const AUTH_TTL_MS = 30 * 60 * 1000
const PROFILE_TTL_MS = 24 * 60 * 60 * 1000

export type { InstrumentProfile }

let auth: { crumb: string; cookie: string; at: number } | null = null
const profileCache = new Map<string, { profile: InstrumentProfile | null; at: number }>()

async function getAuth(): Promise<{ crumb: string; cookie: string } | null> {
  if (auth && Date.now() - auth.at < AUTH_TTL_MS) return auth
  try {
    const res = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA } })
    const getSetCookie = (res.headers as { getSetCookie?: () => string[] }).getSetCookie
    const cookies = getSetCookie ? getSetCookie.call(res.headers) : []
    const cookie = cookies.map((c) => c.split(';')[0]).join('; ')
    const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': UA, Cookie: cookie },
    })
    const crumb = (await crumbRes.text()).trim()
    if (!crumb || crumb.includes('<')) return null
    auth = { crumb, cookie, at: Date.now() }
    return auth
  } catch {
    return null
  }
}

interface SummaryResponse {
  quoteSummary?: { result?: Array<Record<string, unknown>> | null }
}
interface RawHolding {
  symbol?: string
  holdingName?: string
  holdingPercent?: { raw?: number }
}

/** Fetch + cache the look-through/profile for one Yahoo symbol. */
export async function fetchInstrumentProfile(symbol: string): Promise<InstrumentProfile | null> {
  const cached = profileCache.get(symbol)
  if (cached && Date.now() - cached.at < PROFILE_TTL_MS) return cached.profile

  const a = await getAuth()
  if (!a) return null

  const url =
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}` +
    `?modules=topHoldings,assetProfile&crumb=${encodeURIComponent(a.crumb)}`

  let profile: InstrumentProfile | null = null
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Cookie: a.cookie } })
    if (res.ok) {
      const result = (await res.json() as SummaryResponse).quoteSummary?.result?.[0]
      if (result) {
        const th = (result.topHoldings ?? {}) as {
          holdings?: RawHolding[]
          sectorWeightings?: Array<Record<string, { raw?: number }>>
        }
        const ap = (result.assetProfile ?? {}) as { country?: string; sector?: string }

        const holdings = (th.holdings ?? [])
          .filter((h) => h.symbol)
          .map((h) => ({
            symbol: h.symbol!,
            name: h.holdingName ?? h.symbol!,
            weight: h.holdingPercent?.raw ?? 0,
          }))
        const sectorWeights: Record<string, number> = {}
        for (const entry of th.sectorWeightings ?? []) {
          const [key, val] = Object.entries(entry)[0] ?? []
          if (key && val?.raw != null) sectorWeights[key] = val.raw
        }
        const isFund = holdings.length > 0 || Object.keys(sectorWeights).length > 0
        profile = {
          isFund,
          sectorWeights,
          holdings,
          country: ap.country ?? null,
          sector: ap.sector ?? null,
        }
      }
    }
  } catch {
    profile = null
  }

  profileCache.set(symbol, { profile, at: Date.now() })
  return profile
}
