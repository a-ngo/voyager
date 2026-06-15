'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Rocket, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NAV_ITEMS, NAV_GROUP_LABELS, type NavItem } from './nav-config'
import { ThemePicker } from './ThemePicker'
import { PrivacyToggle } from './PrivacyToggle'
import { signout } from '@/app/(auth)/actions'
import { cn } from '@/lib/utils/cn'

const GROUP_ORDER: NavItem['group'][] = ['core', 'analytics', 'tools', 'settings']
const STORAGE_KEY = 'voyager:sidebar-collapsed'

export function Sidebar() {
  const pathname = usePathname()
  const visible = NAV_ITEMS.filter((item) => !item.hidden)
  const [collapsed, setCollapsed] = useState(false)

  // Restore the saved preference after mount (avoids SSR/client mismatch).
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === '1') setCollapsed(true)
  }, [])

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-screen shrink-0 flex-col border-r border-border bg-panel transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div
        className={cn(
          'flex h-14 items-center border-b border-border px-3',
          collapsed ? 'justify-center' : 'gap-2',
        )}
      >
        {!collapsed && (
          <>
            <Rocket className="h-5 w-5 shrink-0 text-brand" />
            <span className="font-serif text-lg font-medium tracking-tight text-brand">Voyager</span>
          </>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'rounded-md p-1.5 text-muted transition-colors hover:bg-panel-elevated hover:text-foreground',
            !collapsed && 'ml-auto',
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {GROUP_ORDER.map((group) => {
          const items = visible.filter((item) => item.group === group)
          if (items.length === 0) return null
          return (
            <div key={group} className="mb-4">
              {!collapsed && (
                <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-widest text-faint">
                  {NAV_GROUP_LABELS[group]}
                </p>
              )}
              <ul className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  const Icon = item.icon
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'flex items-center rounded-md py-1.5 text-sm transition-colors',
                          collapsed ? 'justify-center px-0' : 'gap-2.5 px-2',
                          active
                            ? 'bg-brand/10 text-brand'
                            : 'text-muted hover:bg-panel-elevated hover:text-foreground',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed && (
                          <>
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
                          </>
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

      <div className="flex flex-col gap-0.5 border-t border-border px-2 py-2">
        <ThemePicker collapsed={collapsed} />
        <PrivacyToggle collapsed={collapsed} />
        <form action={signout}>
          <button
            type="submit"
            title={collapsed ? 'Sign out' : undefined}
            className={cn(
              'flex w-full items-center rounded-md py-1.5 text-sm text-muted transition-colors hover:bg-panel-elevated hover:text-foreground',
              collapsed ? 'justify-center px-0' : 'gap-2.5 px-2',
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="flex-1 truncate text-left">Sign out</span>}
          </button>
        </form>
      </div>
    </aside>
  )
}
