import { Sidebar } from '@/components/shared/Sidebar'
import { Providers } from '@/components/shared/providers'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-x-hidden px-6 py-5">{children}</main>
      </div>
    </Providers>
  )
}
