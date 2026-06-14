/**
 * MODEL_REGISTRY — single source of truth for the assistant's model dropdown,
 * same philosophy as WIDGET_REGISTRY / NAV_ITEMS. No secrets live here, so this
 * file is safe to import in client components (the dropdown reads it directly).
 *
 * Key = `${provider}:${model}` — the exact string the provider registry
 * (lib/ai/providers.ts) resolves via `registry.languageModel(id)`. Never rename
 * a key after release: it's the stable ID persisted with conversations/prefs.
 *
 * Adding a model = one entry here + (if it's a new provider) one line in
 * providers.ts. The server-side allowlist and the UI both derive from this.
 */

export type Provider = 'anthropic' | 'deepseek' | 'local'

export interface ModelMeta {
  /** Display label for the dropdown. */
  label: string
  /** Provider key registered in lib/ai/providers.ts. */
  provider: Provider
  /** Bare provider model string (the part after the `:`). */
  model: string
  /** Whether the model reliably supports tool calling — the assistant is tool-based, so this gates it. */
  supportsTools: boolean
  /** Where the user's data goes, for the dynamic privacy disclaimer. `null` = stays on-device (local). */
  sendsDataTo: string | null
  /** Runs on the user's machine — no data leaves the device. */
  local: boolean
}

export const MODEL_REGISTRY = {
  'anthropic:claude-opus-4-8': {
    label: 'Claude Opus 4.8',
    provider: 'anthropic',
    model: 'claude-opus-4-8',
    supportsTools: true,
    sendsDataTo: 'Anthropic',
    local: false,
  },
  // Hosted, cheap, strong tool use. DeepSeek-V3 (`deepseek-chat`); needs DEEPSEEK_API_KEY.
  'deepseek:deepseek-chat': {
    label: 'DeepSeek V3',
    provider: 'deepseek',
    model: 'deepseek-chat',
    supportsTools: true,
    sendsDataTo: 'DeepSeek',
    local: false,
  },
  // Local via Ollama (OpenAI-compatible at localhost:11434). The model tag's own
  // colon (e.g. `qwen3:14b`) is preserved — the registry splits on the first colon
  // only. Each must be pulled first (`ollama pull <model>`). All support tool
  // calling, but less reliably than hosted models — see §8 capability gating.
  // Footprints are ~Q4 and assume a 24 GB Mac running the dev server alongside.
  'local:qwen3:14b': {
    label: 'Qwen3 14B (local)', // recommended local default — best tool use that fits comfortably (~9 GB)
    provider: 'local',
    model: 'qwen3:14b',
    supportsTools: true,
    sendsDataTo: null,
    local: true,
  },
  'local:qwen3:30b-a3b': {
    label: 'Qwen3 30B-A3B (local)', // MoE, ~3B active → fast; ~17 GB, tight alongside dev server
    provider: 'local',
    model: 'qwen3:30b-a3b',
    supportsTools: true,
    sendsDataTo: null,
    local: true,
  },
  'local:qwen2.5:14b': {
    label: 'Qwen2.5 14B (local)', // prior-gen, solid fallback (~9 GB)
    provider: 'local',
    model: 'qwen2.5:14b',
    supportsTools: true,
    sendsDataTo: null,
    local: true,
  },
  'local:mistral-small3.2:24b': {
    label: 'Mistral Small 3.2 (local)', // strong instruction-follower (~14 GB, tighter/slower)
    provider: 'local',
    model: 'mistral-small3.2:24b',
    supportsTools: true,
    sendsDataTo: null,
    local: true,
  },
  'local:llama3.1:8b': {
    label: 'Llama 3.1 8B (local)', // lightest/fastest (~5 GB), weakest tool reliability
    provider: 'local',
    model: 'llama3.1:8b',
    supportsTools: true,
    sendsDataTo: null,
    local: true,
  },
} as const satisfies Record<string, ModelMeta>

export type ModelId = keyof typeof MODEL_REGISTRY

/** Tuple form for `z.enum(...)` — the server-side model allowlist. */
export const MODEL_IDS = Object.keys(MODEL_REGISTRY) as [ModelId, ...ModelId[]]

export const DEFAULT_MODEL_ID: ModelId = 'anthropic:claude-opus-4-8'

/** Client-safe catalog for rendering the dropdown. */
export const MODEL_OPTIONS = MODEL_IDS.map((id) => ({ id, ...MODEL_REGISTRY[id] }))
