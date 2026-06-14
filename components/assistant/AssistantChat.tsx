'use client'

import { useState } from 'react'
import type { UIMessage } from 'ai'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MODEL_OPTIONS, MODEL_REGISTRY, DEFAULT_MODEL_ID, type ModelId } from '@/lib/ai/models'
import type { ConversationSummary } from '@/lib/db/ai-conversations'

interface Props {
  initialConversations: ConversationSummary[]
  initialConversationId: string | null
  initialMessages: UIMessage[]
}

/**
 * Chat UI over /api/ai/chat with persisted conversations. The model dropdown and
 * privacy notice derive from MODEL_REGISTRY; the selected model + conversation id
 * are sent per-message so the server validates the model and persists the turn.
 */
export function AssistantChat({ initialConversations, initialConversationId, initialMessages }: Props) {
  const queryClient = useQueryClient()
  const [conversationId, setConversationId] = useState<string>(
    () => initialConversationId ?? crypto.randomUUID(),
  )
  const [modelId, setModelId] = useState<ModelId>(DEFAULT_MODEL_ID)
  const [input, setInput] = useState('')

  const { messages, sendMessage, setMessages, status, error } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: '/api/ai/chat' }),
    // Refresh the list after each turn so a new conversation + its title appear.
    onFinish: () => void queryClient.invalidateQueries({ queryKey: ['ai-conversations'] }),
  })

  const { data: conversations = [] } = useQuery<ConversationSummary[]>({
    queryKey: ['ai-conversations'],
    queryFn: async () => {
      const res = await fetch('/api/ai/conversations')
      if (!res.ok) throw new Error('Failed to load conversations')
      return res.json() as Promise<ConversationSummary[]>
    },
    initialData: initialConversations,
  })

  const meta = MODEL_REGISTRY[modelId]
  const busy = status === 'submitted' || status === 'streaming'

  function newChat() {
    setMessages([])
    setConversationId(crypto.randomUUID())
  }

  async function switchTo(c: ConversationSummary) {
    if (c.id === conversationId) return
    const res = await fetch(`/api/ai/conversations/${c.id}`)
    if (!res.ok) return
    const data = (await res.json()) as { messages: UIMessage[] }
    setMessages(data.messages)
    setConversationId(c.id)
    if (c.modelId && c.modelId in MODEL_REGISTRY) setModelId(c.modelId as ModelId)
  }

  async function removeConv(id: string) {
    await fetch(`/api/ai/conversations/${id}`, { method: 'DELETE' })
    void queryClient.invalidateQueries({ queryKey: ['ai-conversations'] })
    if (id === conversationId) newChat()
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    void sendMessage({ text }, { body: { modelId, conversationId } })
    setInput('')
  }

  return (
    <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
      <aside className="flex flex-col gap-2">
        <Button onClick={newChat}>+ New chat</Button>
        <div className="flex flex-col gap-1">
          {conversations.map((c) => {
            const active = c.id === conversationId
            return (
              <div
                key={c.id}
                className={`flex items-center gap-1 rounded-md px-2 text-sm ${active ? 'bg-panel-elevated' : 'hover:bg-panel'}`}
              >
                <button
                  onClick={() => switchTo(c)}
                  className={`flex-1 truncate py-1.5 text-left ${active ? 'text-foreground' : 'text-muted'}`}
                >
                  {c.title ?? 'New chat'}
                </button>
                <button
                  onClick={() => removeConv(c.id)}
                  aria-label="Delete conversation"
                  className="px-1 text-muted hover:text-negative"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      </aside>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex items-center gap-2">
            <label htmlFor="model" className="text-xs text-muted">
              Model
            </label>
            <select
              id="model"
              value={modelId}
              onChange={(e) => setModelId(e.target.value as ModelId)}
              className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted">
              {meta.local
                ? 'Runs locally — your data stays on this machine.'
                : `Data sent to ${meta.sendsDataTo} server-side.`}
            </span>
          </div>

          {!meta.supportsTools && (
            <p className="text-xs text-warning">
              This model does not support tools, so it can&apos;t read your portfolio data. Answers
              will be general only.
            </p>
          )}

          <div className="flex min-h-64 flex-col gap-3 overflow-y-auto rounded-md border border-border p-3">
            {messages.length === 0 && (
              <p className="text-sm text-muted">
                Ask about your allocation, cash, returns, or net worth.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className="text-sm">
                <span className="text-xs font-medium text-muted">
                  {m.role === 'user' ? 'You' : 'Assistant'}
                </span>
                <div className="mt-0.5 flex flex-col gap-1">
                  {m.parts.map((part, i) => {
                    if (part.type === 'text') {
                      return (
                        <span key={i} className="whitespace-pre-wrap">
                          {part.text}
                        </span>
                      )
                    }
                    if (part.type.startsWith('tool-')) {
                      return (
                        <span key={i} className="text-xs text-muted">
                          ↪ read {part.type.slice('tool-'.length)}
                        </span>
                      )
                    }
                    return null
                  })}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-negative/40 bg-negative/5 px-3 py-2 text-xs text-negative"
            >
              {error.message || 'Something went wrong. Please try again.'}
            </p>
          )}

          <form onSubmit={onSubmit} className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What's my current allocation?"
              className="flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-sm"
            />
            <Button type="submit" disabled={busy || !input.trim()}>
              {busy ? 'Thinking…' : 'Send'}
            </Button>
          </form>

          <p className="text-xs text-muted">Analytical, not advisory. Not financial advice.</p>
        </CardContent>
      </Card>
    </div>
  )
}
