'use client'

import { useEffect, useRef, useState } from 'react'
import { Info } from 'lucide-react'

/** A small "ⓘ" button that toggles a brief explanation popover on click (works
 *  on touch, unlike hover/title). Closes on outside click or Escape. */
export function InfoPopover({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`About ${label}`}
        aria-expanded={open}
        className="text-faint transition-colors hover:text-foreground"
      >
        <Info className="h-3 w-3" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-50 mt-1.5 w-60 rounded-md border border-border bg-panel p-2.5 text-left text-[11px] font-normal normal-case leading-relaxed tracking-normal text-muted shadow-lg"
        >
          <span className="mb-0.5 block font-medium text-foreground">{label}</span>
          {children}
        </span>
      )}
    </span>
  )
}
