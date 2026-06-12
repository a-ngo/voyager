import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/shared/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { XrayView } from '@/components/portfolio/xray/XrayView'

export default async function XrayPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="X-Ray"
        description="Look through your funds: real sector, country, currency, and holding exposure."
      />
      <XrayView />
    </div>
  )
}
