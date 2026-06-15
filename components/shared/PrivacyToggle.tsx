'use client'

import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { ANON_STORAGE_KEY } from '@/lib/privacy'

/** Toggle "anonymize amounts". Flips `data-anon` on <html> (CSS blurs amounts)
 *  and persists to localStorage. The attribute is set pre-paint by the layout. */
export function PrivacyToggle({ collapsed = false }: { collapsed?: boolean }) {
  const [anon, setAnon] = useState<boolean | null>(null)

  useEffect(() => {
    setAnon(document.documentElement.getAttribute('data-anon') === '1')
  }, [])

  function toggle() {
    const next = !anon
    document.documentElement.setAttribute('data-anon', next ? '1' : '0')
    try {
      localStorage.setItem(ANON_STORAGE_KEY, next ? '1' : '0')
    } catch {
      // storage disabled — still applies for the session
    }
    setAnon(next)
  }

  const label = anon ? 'Show amounts' : 'Hide amounts'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={anon === true}
      title={collapsed ? label : undefined}
      className={cn(
        'flex w-full items-center rounded-md py-1.5 text-sm text-muted transition-colors hover:bg-panel-elevated hover:text-foreground',
        collapsed ? 'justify-center px-0' : 'gap-2.5 px-2',
      )}
    >
      {anon === null ? (
        <span className="h-4 w-4 shrink-0" />
      ) : anon ? (
        <EyeOff className="h-4 w-4 shrink-0" />
      ) : (
        <Eye className="h-4 w-4 shrink-0" />
      )}
      {!collapsed && <span className="flex-1 truncate text-left">{anon === null ? '' : label}</span>}
    </button>
  )
}
