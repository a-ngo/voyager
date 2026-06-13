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

// Widen this union as providers are added (e.g. 'anthropic' | 'deepseek' | 'local').
export type Provider = 'anthropic'

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
} as const satisfies Record<string, ModelMeta>

export type ModelId = keyof typeof MODEL_REGISTRY

/** Tuple form for `z.enum(...)` — the server-side model allowlist. */
export const MODEL_IDS = Object.keys(MODEL_REGISTRY) as [ModelId, ...ModelId[]]

export const DEFAULT_MODEL_ID: ModelId = 'anthropic:claude-opus-4-8'

/** Client-safe catalog for rendering the dropdown. */
export const MODEL_OPTIONS = MODEL_IDS.map((id) => ({ id, ...MODEL_REGISTRY[id] }))
