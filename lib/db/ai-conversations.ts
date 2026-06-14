import 'server-only'
import { and, desc, eq } from 'drizzle-orm'
import type { UIMessage } from 'ai'
import { getDb } from './index'
import { aiConversations } from './schema'

/**
 * AI assistant conversation persistence. The Drizzle connection bypasses RLS, so
 * every query scopes by `userId` explicitly (defense-in-depth alongside the
 * table's RLS policy).
 */

export interface ConversationSummary {
  id: string
  title: string | null
  modelId: string | null
  updatedAt: string
}

/** Most-recent-first conversation summaries (no message bodies). */
export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const db = getDb()
  return db
    .select({
      id: aiConversations.id,
      title: aiConversations.title,
      modelId: aiConversations.modelId,
      updatedAt: aiConversations.updatedAt,
    })
    .from(aiConversations)
    .where(eq(aiConversations.userId, userId))
    .orderBy(desc(aiConversations.updatedAt))
    .limit(50)
}

/** Full message history for one conversation, or null if it isn't the user's. */
export async function getConversationMessages(
  userId: string,
  id: string,
): Promise<UIMessage[] | null> {
  const db = getDb()
  const [row] = await db
    .select({ messages: aiConversations.messages })
    .from(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)))
    .limit(1)
  return row ? (row.messages as UIMessage[]) : null
}

/**
 * Upsert a conversation. Title is set on creation and preserved on update.
 * `setWhere` guards against overwriting another user's row on a UUID collision.
 */
export async function saveConversation(
  userId: string,
  args: { id: string; messages: UIMessage[]; modelId: string; title: string },
): Promise<void> {
  const db = getDb()
  const now = new Date().toISOString()
  await db
    .insert(aiConversations)
    .values({
      id: args.id,
      userId,
      title: args.title,
      modelId: args.modelId,
      messages: args.messages,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: aiConversations.id,
      set: { messages: args.messages, modelId: args.modelId, updatedAt: now },
      setWhere: eq(aiConversations.userId, userId),
    })
}

export async function deleteConversation(userId: string, id: string): Promise<void> {
  const db = getDb()
  await db
    .delete(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)))
}
