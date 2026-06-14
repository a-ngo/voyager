import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/shared/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { NewsView } from '@/components/news/NewsView'

export default async function NewsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="News"
        description="Market, economic, and company news. The For You tab — a feed ranked to your portfolio — is coming soon."
      />
      <NewsView />
    </div>
  )
}
