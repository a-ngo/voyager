import type { UIMessage } from 'ai'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/shared/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { AssistantChat } from '@/components/assistant/AssistantChat'
import {
  listConversations,
  getConversationMessages,
  type ConversationSummary,
} from '@/lib/db/ai-conversations'

export default async function AssistantPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Best-effort initial load; a DB hiccup shouldn't break the page.
  let conversations: ConversationSummary[] = []
  let initialMessages: UIMessage[] = []
  try {
    conversations = await listConversations(user.id)
    if (conversations[0]) {
      initialMessages = (await getConversationMessages(user.id, conversations[0].id)) ?? []
    }
  } catch {
    conversations = []
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="AI Assistant"
        description="Ask about your allocation, drift, returns, and net worth. A compact summary of your portfolio is sent to the selected model server-side, never raw transactions."
      />
      <AssistantChat
        initialConversations={conversations}
        initialConversationId={conversations[0]?.id ?? null}
        initialMessages={initialMessages}
      />
    </div>
  )
}
