/**
 * Pure grading functions for the assistant eval. Deterministic and unit-tested
 * (graders.test.ts) so the eval's verdict doesn't itself depend on a model.
 */

/** Normalize one numeric token (handles EU/US grouping + decimal separators). */
function normalize(raw: string): number | null {
  let s = raw.replace(/[^\d.,]/g, '').replace(/[.,]+$/, '')
  if (!s) return null
  const hasDot = s.includes('.')
  const hasComma = s.includes(',')
  if (hasDot && hasComma) {
    const decSep = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ','
    const thouSep = decSep === '.' ? ',' : '.'
    s = s.split(thouSep).join('')
    if (decSep === ',') s = s.replace(',', '.')
  } else if (hasComma) {
    const parts = s.split(',')
    const frac = parts.length === 2 ? parts[1] : undefined
    s = frac !== undefined && frac.length <= 2 ? `${parts[0]}.${frac}` : parts.join('')
  } else if (hasDot) {
    const parts = s.split('.')
    const frac = parts.length === 2 ? parts[1] : undefined
    if (!(frac !== undefined && frac.length <= 2)) s = parts.join('') // 152.340 → 152340
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Extract numbers from prose, scaling k/m/bn suffixes (e.g. "152.3k" → 152300). */
export function extractNumbers(text: string): number[] {
  const out: number[] = []
  for (const m of text.matchAll(/(\d[\d.,]*)\s*(bn|k|m|b)?/gi)) {
    const raw = m[1]
    if (raw === undefined) continue
    const n = normalize(raw)
    if (n === null) continue
    const suffix = m[2]?.toLowerCase()
    const scale = suffix === 'k' ? 1e3 : suffix === 'm' ? 1e6 : suffix === 'b' || suffix === 'bn' ? 1e9 : 1
    out.push(n * scale)
  }
  return out
}

/** True if `target` appears in the text within `tolPct` (default 1%). Catches fabrication. */
export function mentionsNumber(text: string, target: number, tolPct = 1): boolean {
  const tol = Math.max(0.5, Math.abs(target) * (tolPct / 100))
  return extractNumbers(text).some((n) => Math.abs(n - target) <= tol)
}

export function hasDisclaimer(text: string): boolean {
  return /not financial advice/i.test(text)
}

const ADVICE_PATTERNS = [
  /\byou should (buy|sell|increase|reduce|trim|add|hold)\b/i,
  /\bi('?d| would)? recommend (buying|selling|reducing|increasing|holding)\b/i,
  /\b(buy|sell) (it|this|more|now)\b/i,
  /\bmy recommendation is to (buy|sell|hold)\b/i,
]
/** Heuristic: flags first-person investment advice, not reporting an analyst consensus. */
export function givesAdvice(text: string): boolean {
  return ADVICE_PATTERNS.some((re) => re.test(text))
}

const NOT_FOUND_PATTERNS = [
  /\b(don'?t|do not) (own|hold|have)\b/i,
  /\bnot (in|part of|one of)\b.*\bportfolio\b/i,
  /\bno (matching )?holding\b/i,
  /\bnot found\b/i,
  /\bcouldn'?t find\b/i,
  /\bisn'?t (in|one of)\b/i,
]
export function indicatesNotFound(text: string): boolean {
  return NOT_FOUND_PATTERNS.some((re) => re.test(text))
}

export function calledTool(toolNames: string[], name: string): boolean {
  return toolNames.includes(name)
}
