import 'server-only'
import { generateText, type LanguageModel } from 'ai'
import { getValuedOverview } from '@/lib/portfolio/valued-overview'
import { getXray } from '@/lib/portfolio/xray'
import { registry, missingApiKeyEnv } from '@/lib/ai/providers'
import { MODEL_REGISTRY, type ModelId } from '@/lib/ai/models'
import { fetchFeed } from './general'
import { buildQueries, queryUrl } from './queries'
import { rankByRecency, sortRanked, parseRanking } from './rank'
import type { PersonalNews, RankedNewsItem } from './types'

/**
 * Personalized "For You" feed. Builds queries from the portfolio, gathers
 * candidate headlines from keyless RSS, and asks the selected model to rank them
 * by relevance. Falls back to recency when no model is available (no key / local
 * down). Cached per user+model (~30 min). The model only ever ranks the real
 * candidates by index — it never invents news.
 */

const TTL_MS = 30 * 60_000
const PER_QUERY = 4
const cache = new Map<string, { at: number; value: PersonalNews }>()

async function gatherCandidates(
  userId: string,
): Promise<{ candidates: RankedNewsItem[]; holdings: string[]; sectors: string[] }> {
  const overview = await getValuedOverview(userId)
  const holdings = overview.positions
    .filter((p) => p.priced && p.marketValue != null && p.marketValue > 0)
    .map((p) => ({ name: p.label, ticker: p.ticker, marketValue: p.marketValue ?? 0 }))

  let sectors: string[] = []
  try {
    sectors = (await getXray(userId)).sectors.slices.map((s) => s.label)
  } catch {
    // Sectors are optional — the look-through can fail or be slow.
  }

  const queries = buildQueries({ holdings, sectors })
  const perQuery = await Promise.all(
    queries.map(async (q) =>
      (await fetchFeed(queryUrl(q)))
        .slice(0, PER_QUERY)
        .map<RankedNewsItem>((it) => ({ ...it, bucket: q.bucket, relatedTo: q.relatedTo, relevance: 'medium', why: null })),
    ),
  )

  const seen = new Set<string>()
  const candidates: RankedNewsItem[] = []
  for (const it of perQuery.flat()) {
    const key = it.url || it.title.toLowerCase()
    if (key && !seen.has(key)) {
      seen.add(key)
      candidates.push(it)
    }
  }

  const labels = (bucket: string) => [
    ...new Set(queries.filter((q) => q.bucket === bucket).map((q) => q.relatedTo)),
  ]
  return { candidates, holdings: labels('holding'), sectors: labels('sector') }
}

async function rankWithModel(
  model: LanguageModel,
  holdings: string[],
  sectors: string[],
  candidates: RankedNewsItem[],
): Promise<RankedNewsItem[] | null> {
  const list = candidates
    .map((c, i) => `${i}. [${c.bucket}:${c.relatedTo}] ${c.title} (${c.source})`)
    .join('\n')
  const system =
    'You rank news for a personal investor by relevance to their portfolio. Only include items genuinely relevant to their holdings, sectors, or macro exposure. Be selective — omit generic or off-topic items.'
  const prompt = `Portfolio holdings: ${holdings.join(', ') || 'n/a'}.
Sectors: ${sectors.join(', ') || 'n/a'}.

Candidate headlines:
${list}

Return a JSON array of the relevant ones, most relevant first:
[{"index": <number>, "relevance": "high"|"medium"|"low", "why": "<one short sentence>"}]
Omit irrelevant items. Return only the JSON array.`

  try {
    const { text } = await generateText({ model, system, prompt })
    const signals = parseRanking(text)
    if (signals.length === 0) return null
    const picked: RankedNewsItem[] = []
    const used = new Set<number>()
    for (const s of signals) {
      const c = candidates[s.index]
      if (!c || used.has(s.index)) continue
      used.add(s.index)
      picked.push({ ...c, relevance: s.relevance, why: s.why || null })
    }
    return picked.length > 0 ? sortRanked(picked) : null
  } catch {
    return null
  }
}

export async function getPersonalNews(userId: string, modelId: ModelId): Promise<PersonalNews> {
  const key = `${userId}:${modelId}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value

  const { candidates, holdings, sectors } = await gatherCandidates(userId)

  let value: PersonalNews
  if (candidates.length === 0) {
    value = { items: [], ranked: false, note: 'No holdings yet — import transactions to get a personalized feed.' }
  } else {
    const meta = MODEL_REGISTRY[modelId]
    const missingKey = missingApiKeyEnv(meta.provider)
    if (missingKey) {
      value = {
        items: rankByRecency(candidates),
        ranked: false,
        note: `AI ranking needs ${missingKey} (or pick a local model) — showing by recency.`,
      }
    } else {
      const ranked = await rankWithModel(registry.languageModel(modelId), holdings, sectors, candidates)
      value = ranked
        ? { items: ranked, ranked: true, note: null }
        : { items: rankByRecency(candidates), ranked: false, note: 'AI ranking unavailable right now — showing by recency.' }
    }
  }

  cache.set(key, { at: Date.now(), value })
  return value
}
