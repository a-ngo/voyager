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
    `?modules=topHoldings,assetProfile,fundProfile&crumb=${encodeURIComponent(a.crumb)}`

  let profile: InstrumentProfile | null = null
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Cookie: a.cookie } })
    if (res.ok) {
      const result = (await res.json() as SummaryResponse).quoteSummary?.result?.[0]
      if (result) {
        const th = (result.topHoldings ?? {}) as {
          holdings?: RawHolding[]
          sectorWeightings?: Array<Record<string, { raw?: number }>>
          feesExpensesInvestment?: { annualReportExpenseRatio?: { raw?: number } }
        }
        const ap = (result.assetProfile ?? {}) as { country?: string; sector?: string }
        const fp = (result.fundProfile ?? {}) as {
          feesExpensesInvestment?: { annualReportExpenseRatio?: { raw?: number } }
        }

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
        const ter =
          fp.feesExpensesInvestment?.annualReportExpenseRatio?.raw ??
          th.feesExpensesInvestment?.annualReportExpenseRatio?.raw ??
          null
        profile = {
          isFund,
          sectorWeights,
          holdings,
          country: ap.country ?? null,
          sector: ap.sector ?? null,
          ter: isFund ? ter : null,
        }
      }
    }
  } catch {
    profile = null
  }

  profileCache.set(symbol, { profile, at: Date.now() })
  return profile
}

export interface RecommendationTrend {
  period: string
  strongBuy: number
  buy: number
  hold: number
  sell: number
  strongSell: number
}

/** Per-instrument fundamentals + analyst data for the holding detail view. */
export interface InstrumentDetail {
  symbol: string
  name: string | null
  currency: string | null
  price: number | null
  sector: string | null
  industry: string | null
  country: string | null
  summary: string | null
  marketCap: number | null
  trailingPE: number | null
  forwardPE: number | null
  dividendYield: number | null // fraction
  beta: number | null
  fiftyTwoWeekLow: number | null
  fiftyTwoWeekHigh: number | null
  eps: number | null
  profitMargin: number | null // fraction
  returnOnEquity: number | null // fraction
  targetLow: number | null
  targetMean: number | null
  targetHigh: number | null
  recommendationKey: string | null
  numberOfAnalysts: number | null
  recommendationTrend: RecommendationTrend[]
}

const detailCache = new Map<string, { detail: InstrumentDetail | null; at: number }>()
const DETAIL_TTL_MS = 60 * 60 * 1000

function rawNum(v: unknown): number | null {
  if (typeof v === 'number') return v
  if (v && typeof v === 'object' && 'raw' in v) {
    const r = (v as { raw?: unknown }).raw
    return typeof r === 'number' ? r : null
  }
  return null
}
function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

/** Fetch + cache fundamentals/analyst detail for one Yahoo symbol. */
export async function fetchInstrumentDetail(symbol: string): Promise<InstrumentDetail | null> {
  const cached = detailCache.get(symbol)
  if (cached && Date.now() - cached.at < DETAIL_TTL_MS) return cached.detail

  const a = await getAuth()
  if (!a) return null

  const url =
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}` +
    `?modules=price,summaryDetail,defaultKeyStatistics,financialData,recommendationTrend,assetProfile` +
    `&crumb=${encodeURIComponent(a.crumb)}`

  let detail: InstrumentDetail | null = null
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Cookie: a.cookie } })
    if (res.ok) {
      const r = (await res.json() as SummaryResponse).quoteSummary?.result?.[0]
      if (r) {
        const price = (r.price ?? {}) as Record<string, unknown>
        const sd = (r.summaryDetail ?? {}) as Record<string, unknown>
        const ks = (r.defaultKeyStatistics ?? {}) as Record<string, unknown>
        const fd = (r.financialData ?? {}) as Record<string, unknown>
        const ap = (r.assetProfile ?? {}) as Record<string, unknown>
        const trend = ((r.recommendationTrend ?? {}) as { trend?: RecommendationTrend[] }).trend ?? []

        detail = {
          symbol,
          name: str(price.longName) ?? str(price.shortName),
          currency: str(price.currency),
          price: rawNum(price.regularMarketPrice),
          sector: str(ap.sector),
          industry: str(ap.industry),
          country: str(ap.country),
          summary: str(ap.longBusinessSummary),
          marketCap: rawNum(sd.marketCap) ?? rawNum(ks.enterpriseValue),
          trailingPE: rawNum(sd.trailingPE),
          forwardPE: rawNum(sd.forwardPE),
          dividendYield: rawNum(sd.dividendYield),
          beta: rawNum(sd.beta) ?? rawNum(ks.beta),
          fiftyTwoWeekLow: rawNum(sd.fiftyTwoWeekLow),
          fiftyTwoWeekHigh: rawNum(sd.fiftyTwoWeekHigh),
          eps: rawNum(ks.trailingEps),
          profitMargin: rawNum(fd.profitMargins) ?? rawNum(ks.profitMargins),
          returnOnEquity: rawNum(fd.returnOnEquity),
          targetLow: rawNum(fd.targetLowPrice),
          targetMean: rawNum(fd.targetMeanPrice),
          targetHigh: rawNum(fd.targetHighPrice),
          recommendationKey: str(fd.recommendationKey),
          numberOfAnalysts: rawNum(fd.numberOfAnalystOpinions),
          recommendationTrend: trend.slice(0, 1).map((t) => ({
            period: t.period,
            strongBuy: t.strongBuy ?? 0,
            buy: t.buy ?? 0,
            hold: t.hold ?? 0,
            sell: t.sell ?? 0,
            strongSell: t.strongSell ?? 0,
          })),
        }
      }
    }
  } catch {
    detail = null
  }

  detailCache.set(symbol, { detail, at: Date.now() })
  return detail
}
