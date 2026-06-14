import type { UIMessage } from 'ai'

/**
 * Summarize-on-overflow planning (pure). When a conversation's estimated size
 * exceeds a fraction of the model's context window, older messages are folded
 * into a summary and only the most recent turns are sent verbatim. This trims
 * the *model input* only — the full history stays in the DB and UI.
 */

const CHARS_PER_TOKEN = 4
/** Rough token cost charged to a non-text part (tool call / result). */
const NON_TEXT_PART_TOKENS = 200
/** Fraction of the context window the prompt may use before compaction triggers. */
export const COMPACT_FRACTION = 0.5
/** Most recent messages always kept verbatim. */
export const KEEP_RECENT = 6

export function estimateTokens(messages: UIMessage[]): number {
  let chars = 0
  let nonText = 0
  for (const m of messages) {
    for (const p of m.parts) {
      if (p.type === 'text') chars += p.text.length
      else nonText += 1
    }
  }
  return Math.ceil(chars / CHARS_PER_TOKEN) + nonText * NON_TEXT_PART_TOKENS
}

export interface CompactionPlan {
  compact: boolean
  toSummarize: UIMessage[]
  toKeep: UIMessage[]
}

/**
 * Decide whether to compact. Compacts when the estimate exceeds
 * `contextTokens * COMPACT_FRACTION` and there's more than `keepRecent` history.
 */
export function planCompaction(
  messages: UIMessage[],
  contextTokens: number,
  keepRecent: number = KEEP_RECENT,
): CompactionPlan {
  const budget = contextTokens * COMPACT_FRACTION
  if (messages.length <= keepRecent + 1 || estimateTokens(messages) <= budget) {
    return { compact: false, toSummarize: [], toKeep: messages }
  }
  return {
    compact: true,
    toSummarize: messages.slice(0, -keepRecent),
    toKeep: messages.slice(-keepRecent),
  }
}

/** Flatten messages to `role: text` lines for the summarizer prompt (text only). */
export function messagesToText(messages: UIMessage[]): string {
  return messages
    .map((m) => {
      const text = m.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])).join(' ').trim()
      return text ? `${m.role}: ${text}` : ''
    })
    .filter(Boolean)
    .join('\n')
}
