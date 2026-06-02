'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Rocket } from 'lucide-react'
import { NAV_ITEMS, NAV_GROUP_LABELS, type NavItem } from './nav-config'
import { cn } from '@/lib/utils/cn'

const GROUP_ORDER: NavItem['group'][] = ['core', 'analytics', 'tools', 'settings']

export function Sidebar() {
  const pathname = usePathname()
  const visible = NAV_ITEMS.filter((item) => !item.hidden)

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-panel">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <Rocket className="h-5 w-5 text-brand" />
        <span className="text-base font-semibold tracking-tight text-brand">Voyager</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {GROUP_ORDER.map((group) => {
          const items = visible.filter((item) => item.group === group)
          if (items.length === 0) return null
          return (
            <div key={group} className="mb-4">
              <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-widest text-faint">
                {NAV_GROUP_LABELS[group]}
              </p>
              <ul className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  const Icon = item.icon
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                          active
                            ? 'bg-brand/10 text-brand'
                            : 'text-muted hover:bg-panel-elevated hover:text-foreground',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && (
                          <span
                            className={cn(
                              'rounded-[var(--radius-button)] px-1.5 py-0.5 text-[9px] uppercase tracking-wide',
                              item.badge === 'beta'
                                ? 'bg-purple/15 text-purple'
                                : 'bg-positive/15 text-positive',
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      <div className="border-t border-border px-4 py-3 text-[10px] text-faint">
        To the moon and beyond.
      </div>
    </aside>
  )
}
