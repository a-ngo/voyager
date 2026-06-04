'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EDITABLE_BUCKETS, BUCKET_LABEL, BUCKET_COLOR } from '@/lib/portfolio/buckets'

type Targets = Record<string, number>

export function TargetAllocationForm({ initialTargets }: { initialTargets: Targets }) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<Targets>(() => {
    const seeded: Targets = {}
    for (const b of EDITABLE_BUCKETS) seeded[b] = initialTargets[b] ?? 0
    return seeded
  })
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const total = Object.values(values).reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0)
  const balanced = Math.abs(total - 100) < 0.01

  function set(bucket: string, raw: string) {
    const n = Number(raw)
    setValues((prev) => ({ ...prev, [bucket]: Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0 }))
    setStatus('idle')
  }

  async function save() {
    setStatus('saving')
    // Drop zero targets so the widget only shows buckets the user cares about.
    const targets = Object.fromEntries(Object.entries(values).filter(([, v]) => v > 0))
    try {
      const res = await fetch('/api/portfolio/targets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets }),
      })
      if (!res.ok) throw new Error()
      setStatus('saved')
      queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] })
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="flex max-w-sm flex-col gap-3">
      {EDITABLE_BUCKETS.map((bucket) => (
        <label key={bucket} className="flex items-center gap-3 text-sm">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: BUCKET_COLOR[bucket] }} />
          <span className="flex-1 text-foreground">{BUCKET_LABEL[bucket]}</span>
          <input
            type="number"
            min={0}
            max={100}
            value={values[bucket] ?? 0}
            onChange={(e) => set(bucket, e.target.value)}
            className="w-20 rounded-[var(--radius-card)] border border-border bg-panel-elevated px-2 py-1 text-right tabular-nums text-foreground outline-none focus:border-brand"
          />
          <span className="w-4 text-muted">%</span>
        </label>
      ))}

      <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
        <span className="text-muted">Total</span>
        <span className={balanced ? 'tabular-nums text-positive' : 'tabular-nums text-warning'}>
          {total.toFixed(0)}%{balanced ? '' : ' — should be 100%'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="brand" size="sm" onClick={save} disabled={status === 'saving'}>
          {status === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save targets
        </Button>
        {status === 'saved' && (
          <span className="flex items-center gap-1 text-xs text-positive">
            <Check className="h-3.5 w-3.5" /> Saved
          </span>
        )}
        {status === 'error' && <span className="text-xs text-negative">Couldn&apos;t save</span>}
      </div>
    </div>
  )
}
