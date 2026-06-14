import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/shared/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { AssistantChat } from '@/components/assistant/AssistantChat'

export default async function AssistantPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="AI Assistant"
        description="Ask about your allocation, drift, returns, and net worth. A compact summary of your portfolio is sent to the selected model server-side, never raw transactions."
      />
      <AssistantChat />
    </div>
  )
}
