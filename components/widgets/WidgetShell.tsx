'use client'

import { useEffect, useState } from 'react'
import { GripVertical, Settings2, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Shared chrome for every widget: header, drag handle (edit mode), config gear,
 * remove button. Edit controls are never rendered in view mode.
 */
export function WidgetShell({
  title,
  isEditMode,
  onRemove,
  renderConfig,
  children,
}: {
  title: string
  isEditMode: boolean
  onRemove?: () => void
  /** Renders the config editor inside a modal; `close` dismisses it. */
  renderConfig?: (close: () => void) => React.ReactNode
  children: React.ReactNode
}) {
  const [configOpen, setConfigOpen] = useState(false)

  // Closing edit mode also dismisses any open config panel.
  useEffect(() => {
    if (!isEditMode) setConfigOpen(false)
  }, [isEditMode])

  useEffect(() => {
    if (!configOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfigOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [configOpen])

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-panel">
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-border px-2.5">
        {isEditMode && (
          <span className="widget-drag-handle cursor-grab text-faint hover:text-foreground active:cursor-grabbing">
            <GripVertical className="h-4 w-4" />
          </span>
        )}
        <span className="flex-1 truncate text-xs font-medium text-muted">{title}</span>
        {isEditMode && renderConfig && (
          <button
            onClick={() => setConfigOpen(true)}
            aria-label={`Configure ${title}`}
            className="rounded p-0.5 text-faint transition-colors hover:bg-panel-elevated hover:text-foreground"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        )}
        {isEditMode && onRemove && (
          <button
            onClick={onRemove}
            aria-label={`Remove ${title}`}
            className="rounded p-0.5 text-faint transition-colors hover:bg-panel-elevated hover:text-negative"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className={cn('min-h-0 flex-1 p-3', isEditMode && 'pointer-events-none select-none')}>
        {children}
      </div>

      {configOpen && renderConfig && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Configure ${title}`}
          onClick={() => setConfigOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-panel shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
              <button
                type="button"
                onClick={() => setConfigOpen(false)}
                aria-label="Close"
                className="rounded p-1 text-muted hover:bg-panel-elevated hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">{renderConfig(() => setConfigOpen(false))}</div>
          </div>
        </div>
      )}
    </div>
  )
}
