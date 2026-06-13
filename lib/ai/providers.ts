import 'server-only'
import { createProviderRegistry } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import type { Provider } from './models'

/**
 * The AI SDK provider registry — the multi-provider seam. `languageModel(id)`
 * resolves a `${provider}:${model}` key (the same keys as MODEL_REGISTRY) to a
 * configured model. API keys are read from server env here and never reach the
 * client bundle.
 *
 * Adding a provider (DeepSeek, local Ollama via @ai-sdk/openai-compatible) is
 * one entry in this object plus its MODEL_REGISTRY rows — no other code changes.
 */
export const registry = createProviderRegistry({
  anthropic: createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
})

/**
 * Env var holding each provider's API key. `null` = no key needed (local model).
 * Keep in sync with the providers registered above.
 */
const PROVIDER_API_KEY_ENV: Record<Provider, string | null> = {
  anthropic: 'ANTHROPIC_API_KEY',
}

/**
 * Returns the name of the missing API-key env var if the provider needs one and
 * it isn't configured on the server, else `null`. The client can't see env
 * vars, so this is the authoritative check before a request reaches the model.
 */
export function missingApiKeyEnv(provider: Provider): string | null {
  const envVar = PROVIDER_API_KEY_ENV[provider]
  return envVar && !process.env[envVar] ? envVar : null
}
