import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/shared/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { ProjectionsView } from '@/components/projections/ProjectionsView'

export default async function ProjectionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Projections"
        description="Extend your portfolio into the future under different return scenarios — see how contributions and compounding grow it over time."
      />
      <ProjectionsView />
    </div>
  )
}
