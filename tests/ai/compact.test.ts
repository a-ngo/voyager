import { describe, it, expect } from 'vitest'
import type { UIMessage } from 'ai'
import { estimateTokens, planCompaction, messagesToText, KEEP_RECENT } from '@/lib/ai/compact'

function msg(role: UIMessage['role'], text: string): UIMessage {
  return { id: `${role}-${text.slice(0, 8)}`, role, parts: [{ type: 'text', text }] }
}

describe('estimateTokens', () => {
  it('scales with text length (~4 chars/token)', () => {
    expect(estimateTokens([msg('user', 'a'.repeat(400))])).toBe(100)
  })

  it('charges non-text parts a flat cost', () => {
    const m: UIMessage = { id: 'x', role: 'assistant', parts: [{ type: 'step-start' }] }
    expect(estimateTokens([m])).toBe(200)
  })
})

describe('planCompaction', () => {
  it('does not compact a short conversation', () => {
    const msgs = [msg('user', 'hi'), msg('assistant', 'hello')]
    const plan = planCompaction(msgs, 16_000)
    expect(plan.compact).toBe(false)
    expect(plan.toKeep).toEqual(msgs)
  })

  it('does not compact when under the budget even if long', () => {
    const msgs = Array.from({ length: 20 }, (_, i) => msg('user', `q${i}`))
    expect(planCompaction(msgs, 16_000).compact).toBe(false)
  })

  it('compacts when over budget, keeping the most recent turns verbatim', () => {
    // ~250 tokens each (1000 chars) × 20 = ~5000 tokens; budget = 8000*0.5 = 4000.
    const msgs = Array.from({ length: 20 }, (_, i) => msg(i % 2 ? 'assistant' : 'user', 'x'.repeat(1000)))
    const plan = planCompaction(msgs, 8_000)
    expect(plan.compact).toBe(true)
    expect(plan.toKeep).toHaveLength(KEEP_RECENT)
    expect(plan.toSummarize).toHaveLength(20 - KEEP_RECENT)
    // The kept slice is the tail of the original history.
    expect(plan.toKeep).toEqual(msgs.slice(-KEEP_RECENT))
  })
})

describe('messagesToText', () => {
  it('flattens to role: text lines and drops empty turns', () => {
    const out = messagesToText([
      msg('user', 'net worth?'),
      { id: 'tool', role: 'assistant', parts: [{ type: 'step-start' }] },
      msg('assistant', 'It is 152,340 EUR.'),
    ])
    expect(out).toBe('user: net worth?\nassistant: It is 152,340 EUR.')
  })
})
