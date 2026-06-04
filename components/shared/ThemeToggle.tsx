'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const STORAGE_KEY = 'voyager:theme'

/** Light/dark toggle. The initial class is set pre-paint by an inline script in
 *  the root layout; this reads it on mount, so it stays hydration-safe. */
export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null)

  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  }, [])

  function toggle() {
    const next = document.documentElement.classList.toggle('dark') ? 'dark' : 'light'
    localStorage.setItem(STORAGE_KEY, next)
    setTheme(next)
  }

  const label = theme === 'dark' ? 'Light mode' : 'Dark mode'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={collapsed ? label : undefined}
      className={cn(
        'flex w-full items-center rounded-md py-1.5 text-sm text-muted transition-colors hover:bg-panel-elevated hover:text-foreground',
        collapsed ? 'justify-center px-0' : 'gap-2.5 px-2',
      )}
    >
      {/* Render the icon only after mount so SSR and client agree. */}
      {theme === null ? (
        <span className="h-4 w-4 shrink-0" />
      ) : theme === 'dark' ? (
        <Sun className="h-4 w-4 shrink-0" />
      ) : (
        <Moon className="h-4 w-4 shrink-0" />
      )}
      {!collapsed && <span className="flex-1 truncate text-left">{theme === null ? '' : label}</span>}
    </button>
  )
}
