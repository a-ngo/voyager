'use client'

import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { THEMES, DEFAULT_THEME, THEME_STORAGE_KEY, type ThemeId, type ThemeOption } from '@/lib/theme'

/** Theme picker. The active theme is set pre-paint by the inline script in the
 *  root layout; this reads `data-theme` on mount, so it stays hydration-safe. */
export function ThemePicker({ collapsed = false }: { collapsed?: boolean }) {
  const [theme, setTheme] = useState<ThemeId | null>(null)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme')
    setTheme((THEMES.find((t) => t.id === current)?.id ?? DEFAULT_THEME) as ThemeId)
  }, [])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function select(id: ThemeId) {
    document.documentElement.setAttribute('data-theme', id)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id)
    } catch {
      // private mode / storage disabled — selection still applies for the session
    }
    setTheme(id)
    setOpen(false)
  }

  const active = THEMES.find((t) => t.id === theme) ?? THEMES[0]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Theme"
        aria-haspopup="menu"
        aria-expanded={open}
        title={collapsed ? 'Theme' : undefined}
        className={cn(
          'flex w-full items-center rounded-md py-1.5 text-sm text-muted transition-colors hover:bg-panel-elevated hover:text-foreground',
          collapsed ? 'justify-center px-0' : 'gap-2.5 px-2',
        )}
      >
        {theme === null ? <span className="h-4 w-4 shrink-0" /> : <Swatch theme={active} />}
        {!collapsed && (
          <span className="flex-1 truncate text-left">{theme === null ? '' : active.label}</span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-50 w-48 overflow-hidden rounded-md border border-border bg-panel py-1 shadow-lg',
            collapsed ? 'bottom-0 left-full ml-2' : 'bottom-full left-0 mb-1',
          )}
        >
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitemradio"
              aria-checked={t.id === theme}
              onClick={() => select(t.id)}
              className="flex w-full items-center gap-2.5 px-2 py-1.5 text-left hover:bg-panel-elevated"
            >
              <Swatch theme={t} />
              <span className="flex-1">
                <span className="block text-sm text-foreground">{t.label}</span>
                <span className="block text-xs text-faint">{t.hint}</span>
              </span>
              {t.id === theme && <Check className="h-3.5 w-3.5 shrink-0 text-brand" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Swatch({ theme }: { theme: ThemeOption }) {
  return (
    <span
      className="relative h-4 w-4 shrink-0 overflow-hidden rounded-full border border-border"
      style={{ background: theme.swatch.bg }}
    >
      <span
        className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full"
        style={{ background: theme.swatch.accent }}
      />
    </span>
  )
}
