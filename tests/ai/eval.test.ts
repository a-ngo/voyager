import { describe, it, expect, afterAll } from 'vitest'
import { generateText, stepCountIs, type LanguageModel } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { SYSTEM } from '@/lib/ai/system'
import { MODEL_REGISTRY, type ModelId } from '@/lib/ai/models'
import { buildEvalTools, EVAL_CASES, type EvalCase } from './fixture'
import * as g from './graders'

/**
 * Assistant eval — runs the golden cases (tests/ai/fixture.ts) through one or
 * more models with synthetic tools and grades tool-selection, numeric
 * faithfulness, and guardrails with the pure graders (tests/ai/graders.ts).
 *
 * Skipped by default (needs a model). Run it explicitly:
 *   RUN_AI_EVAL=1 npm run eval
 *   EVAL_MODELS=anthropic:claude-opus-4-8,local:qwen3:14b EVAL_K=3 npm run eval
 *
 * EVAL_K = samples per case (pass@k for nondeterminism); a case passes the
 * suite if it passes a majority of K runs.
 */

const ENABLED = process.env.RUN_AI_EVAL === '1'
const K = Math.max(1, Number(process.env.EVAL_K ?? 1))
const MODEL_IDS = (process.env.EVAL_MODELS ?? 'anthropic:claude-opus-4-8')
  .split(',')
  .map((s) => s.trim())
  .filter((s): s is ModelId => s in MODEL_REGISTRY)

function modelFor(id: ModelId): LanguageModel {
  const meta = MODEL_REGISTRY[id]
  switch (meta.provider) {
    case 'anthropic':
      return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(meta.model)
    case 'deepseek':
      return createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY })(meta.model)
    case 'local':
      return createOpenAICompatible({
        name: 'local',
        baseURL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
      })(meta.model)
  }
}

/** Provider has what it needs to run (a key, or a local endpoint). */
function ready(id: ModelId): boolean {
  const p = MODEL_REGISTRY[id].provider
  if (p === 'anthropic') return !!process.env.ANTHROPIC_API_KEY
  if (p === 'deepseek') return !!process.env.DEEPSEEK_API_KEY
  return true // local: assume the endpoint is up; a connection error fails the case loudly
}

async function grade(c: EvalCase, model: LanguageModel): Promise<boolean> {
  const res = await generateText({
    model,
    system: SYSTEM,
    tools: buildEvalTools(),
    stopWhen: stepCountIs(5),
    prompt: c.prompt,
  })
  const text = res.text
  const tools = res.steps.flatMap((s) => s.toolCalls.map((t) => t.toolName))
  if (c.expectTool && !g.calledTool(tools, c.expectTool)) return false
  if (c.expectNumbers && !c.expectNumbers.every((n) => g.mentionsNumber(text, n))) return false
  if (c.expectDisclaimer && !g.hasDisclaimer(text)) return false
  if (c.forbidAdvice && g.givesAdvice(text)) return false
  if (c.expectNotFound && !g.indicatesNotFound(text)) return false
  return true
}

const summary: { model: string; case: string; passed: string }[] = []
afterAll(() => {
  if (summary.length) console.table(summary)
})

describe.skipIf(!ENABLED)('assistant eval', () => {
  for (const id of MODEL_IDS) {
    describe.skipIf(!ready(id))(id, () => {
      for (const c of EVAL_CASES) {
        it(
          `${c.id}: ${c.prompt}`,
          async () => {
            let passes = 0
            for (let i = 0; i < K; i++) {
              if (await grade(c, modelFor(id))) passes++
            }
            summary.push({ model: id, case: c.id, passed: `${passes}/${K}` })
            expect(passes, `${id} · ${c.id}: ${passes}/${K} passed`).toBeGreaterThan(K / 2)
          },
          120_000,
        )
      }
    })
  }
})
