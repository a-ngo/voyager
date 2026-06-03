'use client'

import { GripVertical, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Shared chrome for every widget: header, drag handle (edit mode), remove button.
 * Edit controls are never rendered in view mode.
 */
export function WidgetShell({
  title,
  isEditMode,
  onRemove,
  children,
}: {
  title: string
  isEditMode: boolean
  onRemove?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-panel">
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-border px-2.5">
        {isEditMode && (
          <span className="widget-drag-handle cursor-grab text-faint hover:text-foreground active:cursor-grabbing">
            <GripVertical className="h-4 w-4" />
          </span>
        )}
        <span className="flex-1 truncate text-xs font-medium text-muted">{title}</span>
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
    </div>
  )
}
