'use client'

import { Plus, X } from 'lucide-react'
import { WIDGET_REGISTRY, type WidgetCategory } from './registry'
import { Button } from '@/components/ui/button'

const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  performance: 'Performance',
  allocation: 'Allocation',
  kpi: 'KPIs',
  benchmark: 'Benchmark',
  alerts: 'Alerts',
  other: 'Other',
}

/** Browse + add widgets. Reads entirely from WIDGET_REGISTRY (CLAUDE.md §3.5). */
export function WidgetPicker({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (type: string) => void
}) {
  if (!open) return null

  const defs = Object.values(WIDGET_REGISTRY)

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="flex h-full w-80 flex-col border-l border-border bg-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <span className="text-sm font-semibold text-foreground">Add widget</span>
          <button
            onClick={onClose}
            aria-label="Close widget picker"
            className="rounded p-1 text-faint hover:bg-panel-elevated hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {defs.map((def) => (
            <button
              key={def.type}
              onClick={() => onAdd(def.type)}
              className="mb-2 flex w-full flex-col gap-1 rounded-[var(--radius-card)] border border-border bg-panel-elevated p-3 text-left transition-colors hover:border-border-accent"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{def.label}</span>
                <span className="rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-faint">
                  {CATEGORY_LABELS[def.category]}
                </span>
              </div>
              <span className="text-xs text-muted">{def.description}</span>
            </button>
          ))}
        </div>
        <div className="border-t border-border p-3">
          <Button variant="ghost" size="sm" className="w-full" onClick={onClose}>
            <Plus className="h-4 w-4" /> Done
          </Button>
        </div>
      </div>
    </div>
  )
}
