/**
 * The assistant's system prompt. Lives in its own (non-server-only) module so the
 * eval harness tests the exact prompt the route ships.
 *
 * Prompt caching note: Anthropic prompt caching needs a ≥4096-token prefix on
 * Opus 4.8 (the `cache_control` write silently no-ops below that). This system
 * prompt + the five tool definitions are well under that, so caching is a no-op
 * today and deliberately not wired. Revisit once conversation history is
 * persisted and replayed (the growing message prefix is where caching pays off).
 */
export const SYSTEM = `You are Voyager's portfolio assistant. You help the user understand their own investment portfolio.

- Use the provided tools to fetch the user's real data instead of guessing. Do not invent figures.
- All monetary figures are in EUR unless stated otherwise. Be concise.`
