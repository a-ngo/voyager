'use client'

import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { Responsive, WidthProvider, type Layout } from 'react-grid-layout'
import { Pencil, Check, Plus } from 'lucide-react'
import { getWidgetDefinition } from './registry'
import { WidgetShell } from './WidgetShell'
import { WidgetPicker } from './WidgetPicker'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/PageHeader'

const ResponsiveGridLayout = WidthProvider(Responsive)

interface WidgetInstance {
  id: string
  type: string
  config: unknown
}

const STORAGE_KEY = 'voyager.dashboard.v2'

// Default dashboard shown on first load — persisted to Supabase in production
// (widget_instances + dashboard_layouts). Here we use localStorage as a stand-in.
const DEFAULT_INSTANCES: WidgetInstance[] = [
  { id: 'w-return', type: 'total-return', config: getWidgetDefinition('total-return')?.defaultConfig },
  { id: 'w-networth', type: 'net-worth-goal', config: getWidgetDefinition('net-worth-goal')?.defaultConfig },
  { id: 'w-perf', type: 'performance-chart', config: getWidgetDefinition('performance-chart')?.defaultConfig },
  { id: 'w-target', type: 'allocation-target', config: getWidgetDefinition('allocation-target')?.defaultConfig },
  { id: 'w-alloc', type: 'allocation-pie', config: getWidgetDefinition('allocation-pie')?.defaultConfig },
]

const DEFAULT_LAYOUT: Layout[] = [
  // Top band: KPI stack (left) + hero performance chart (right)
  { i: 'w-return', x: 0, y: 0, w: 3, h: 2 },
  { i: 'w-networth', x: 0, y: 2, w: 3, h: 2 },
  { i: 'w-perf', x: 3, y: 0, w: 9, h: 4 },
  // Bottom band: target-vs-current (wide) + allocation pie
  { i: 'w-target', x: 0, y: 4, w: 7, h: 4 },
  { i: 'w-alloc', x: 7, y: 4, w: 5, h: 4 },
]

interface PersistedState {
  instances: WidgetInstance[]
  layout: Layout[]
}

export function WidgetGrid() {
  const [editMode, setEditMode] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [instances, setInstances] = useState<WidgetInstance[]>(DEFAULT_INSTANCES)
  const [layout, setLayout] = useState<Layout[]>(DEFAULT_LAYOUT)
  const [breakpoint, setBreakpoint] = useState<string>('lg')
  const [hydrated, setHydrated] = useState(false)

  // Load persisted dashboard on mount (client only — avoids SSR mismatch).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedState
        if (Array.isArray(parsed.instances) && Array.isArray(parsed.layout)) {
          setInstances(parsed.instances)
          setLayout(parsed.layout)
        }
      }
    } catch {
      // Corrupt state — fall back to defaults silently.
    }
    setHydrated(true)
  }, [])

  // Persist on change once hydrated.
  useEffect(() => {
    if (!hydrated) return
    const state: PersistedState = { instances, layout }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [instances, layout, hydrated])

  // The persisted layout is authored for the 12-col (lg) grid. On narrow
  // screens we collapse to a single column; react-grid-layout clamps each
  // item to the 1-col grid and stacks them in order. Only the lg layout is
  // persisted (see onLayoutChange) so the mobile-collapsed layout never
  // overwrites the desktop arrangement.
  const layoutsByBreakpoint = useMemo(() => ({ lg: layout, xs: layout }), [layout])

  function addWidget(type: string) {
    const def = getWidgetDefinition(type)
    if (!def) return
    const id = `w-${type}-${Date.now()}`
    setInstances((prev) => [...prev, { id, type, config: def.defaultConfig }])
    setLayout((prev) => [
      ...prev,
      { i: id, x: 0, y: Infinity, w: def.defaultSize.w, h: def.defaultSize.h },
    ])
  }

  function removeWidget(id: string) {
    setInstances((prev) => prev.filter((w) => w.id !== id))
    setLayout((prev) => prev.filter((l) => l.i !== id))
  }

  function updateConfig(id: string, config: unknown) {
    setInstances((prev) => prev.map((w) => (w.id === id ? { ...w, config } : w)))
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Dashboard"
        description="Your portfolio at a glance. Compose it your way."
        actions={
          <>
            {editMode && (
              <Button variant="brand" size="sm" onClick={() => setPickerOpen(true)}>
                <Plus className="h-4 w-4" /> Add widget
              </Button>
            )}
            <Button
              variant={editMode ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setEditMode((e) => !e)}
            >
              {editMode ? (
                <>
                  <Check className="h-4 w-4" /> Done
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4" /> Edit
                </>
              )}
            </Button>
          </>
        }
      />

      <ResponsiveGridLayout
        className="-mx-1.5"
        layouts={layoutsByBreakpoint}
        breakpoints={{ lg: 900, xs: 0 }}
        cols={{ lg: 12, xs: 1 }}
        rowHeight={72}
        margin={[12, 12]}
        isDraggable={editMode}
        isResizable={editMode}
        draggableHandle=".widget-drag-handle"
        onBreakpointChange={(bp) => setBreakpoint(bp)}
        onLayoutChange={(current) => {
          // Only the desktop (lg) layout is the source of truth; ignore edits
          // made to the auto-collapsed single-column mobile layout.
          if (editMode && breakpoint === 'lg') setLayout(current)
        }}
      >
        {instances.map((instance) => {
          const def = getWidgetDefinition(instance.type)
          if (!def) return <div key={instance.id} />
          const Component = def.component
          return (
            <div key={instance.id}>
              <WidgetShell
                title={def.label}
                isEditMode={editMode}
                onRemove={() => removeWidget(instance.id)}
              >
                <Suspense
                  fallback={<div className="h-full animate-pulse rounded bg-panel-elevated" />}
                >
                  <Component
                    widgetId={instance.id}
                    config={instance.config}
                    onConfigChange={(config) => updateConfig(instance.id, config)}
                    isEditMode={editMode}
                  />
                </Suspense>
              </WidgetShell>
            </div>
          )
        })}
      </ResponsiveGridLayout>

      <WidgetPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={(type) => {
          addWidget(type)
          setPickerOpen(false)
        }}
      />
    </div>
  )
}
