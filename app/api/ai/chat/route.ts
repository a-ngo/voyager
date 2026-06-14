import {
  streamText,
  generateText,
  stepCountIs,
  convertToModelMessages,
  validateUIMessages,
  APICallError,
  LoadAPIKeyError,
  type UIMessage,
  type LanguageModel,
} from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { perMinuteLimiter } from '@/lib/prices/rate-limiter'
import { registry, missingApiKeyEnv } from '@/lib/ai/providers'
import { buildTools } from '@/lib/ai/tools'
import { SYSTEM } from '@/lib/ai/system'
import { planCompaction, messagesToText } from '@/lib/ai/compact'
import { saveConversation } from '@/lib/db/ai-conversations'
import { MODEL_IDS, MODEL_REGISTRY, DEFAULT_MODEL_ID, type ModelMeta } from '@/lib/ai/models'

/**
 * POST /api/ai/chat
 * Streaming, tool-using portfolio assistant. Server-side only: session is
 * re-verified, the request is rate-limited, and the selected model is validated
 * against the MODEL_REGISTRY allowlist before it ever reaches the provider
 * registry (a client must not be able to route to an arbitrary provider:model).
 */

export const maxDuration = 60

// Stricter than the price endpoint — model calls are expensive.
const aiRateLimiter = perMinuteLimiter(10)

const BodySchema = z.object({
  // useChat sends UIMessages; validateUIMessages does the real typed validation.
  messages: z.array(z.unknown()),
  modelId: z.enum(MODEL_IDS).default(DEFAULT_MODEL_ID),
  conversationId: z.string().uuid().optional(),
})

/** Condense older turns into a recap. Returns null on failure → caller falls back to truncation. */
async function summarize(model: LanguageModel, messages: UIMessage[]): Promise<string | null> {
  try {
    const { text } = await generateText({
      model,
      system:
        'Summarize this conversation between a user and their portfolio assistant into a concise factual recap: the questions asked, figures and holdings discussed, and any conclusions. Under 200 words, no preamble.',
      prompt: messagesToText(messages),
    })
    const trimmed = text.trim()
    return trimmed.length > 0 ? trimmed : null
  } catch {
    return null
  }
}

/** A short conversation title from the first user message. */
function deriveTitle(messages: UIMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user')
  const text = (firstUser?.parts ?? [])
    .flatMap((p) => (p.type === 'text' ? [p.text] : []))
    .join(' ')
    .trim()
  if (!text) return 'New chat'
  return text.length > 60 ? `${text.slice(0, 57)}…` : text
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!aiRateLimiter.take(user.id).allowed) {
    return new Response('Too many requests', { status: 429 })
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return new Response('Invalid request', { status: 400 })
  }

  const meta = MODEL_REGISTRY[parsed.data.modelId]

  // Preflight: a model that needs an API key the server doesn't have would fail
  // with an opaque stream error. Return a clear, actionable message instead.
  const missingKey = missingApiKeyEnv(meta.provider)
  if (missingKey) {
    return new Response(
      `${meta.label} needs ${missingKey}, which isn't configured on the server. ` +
        `Add it to .env.local and restart the dev server, or pick a local model.`,
      { status: 503 },
    )
  }

  const messages = await validateUIMessages({ messages: parsed.data.messages })
  const model = registry.languageModel(parsed.data.modelId)

  // Summarize-on-overflow: trim the model input when history outgrows the
  // model's context budget. The full history is still persisted (originalMessages
  // below) and shown in the UI — only what we send the model is compacted.
  let system = SYSTEM
  let modelInput = messages
  const plan = planCompaction(messages, meta.contextTokens)
  if (plan.compact) {
    const summary = await summarize(model, plan.toSummarize)
    if (summary) system = `${SYSTEM}\n\n## Earlier conversation (summary)\n${summary}`
    modelInput = plan.toKeep
  }

  const result = streamText({
    model,
    system,
    messages: await convertToModelMessages(modelInput),
    // Only offer tools to models that can call them reliably.
    tools: meta.supportsTools ? buildTools(user.id) : undefined,
    stopWhen: stepCountIs(5),
  })

  const { conversationId, modelId } = parsed.data
  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    // Persist the full conversation after the turn completes (best-effort).
    onFinish: async ({ messages: finalMessages, isAborted }) => {
      if (isAborted || !conversationId) return
      try {
        await saveConversation(user.id, {
          id: conversationId,
          messages: finalMessages,
          modelId,
          title: deriveTitle(finalMessages),
        })
      } catch {
        // Persistence is best-effort; a DB hiccup must not break the response.
      }
    },
    // Map provider failures (bad key, rate limit) to readable client text without
    // leaking internals. The default hides the message for security.
    onError: (error) => streamErrorMessage(error, meta),
  })
}

function streamErrorMessage(error: unknown, meta: ModelMeta): string {
  if (LoadAPIKeyError.isInstance(error)) {
    return `${meta.label} is missing its API key on the server.`
  }
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return `The API key for ${meta.label} is invalid or unauthorized.`
    }
    if (error.statusCode === 429) {
      return `Rate limited by ${meta.sendsDataTo ?? 'the model'}. Wait a moment and try again.`
    }
  }
  if (meta.local) {
    return `Couldn't reach the local model. Make sure Ollama is running (\`ollama serve\`) and the model is pulled (\`ollama pull ${meta.model}\`).`
  }
  return 'The assistant hit an error. Please try again.'
}
