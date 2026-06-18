'use client'

import { useState } from 'react'
import type { WidgetConfigProps } from '../registry'
import { Button } from '@/components/ui/button'
import { usePortfolioSummary } from '@/hooks/usePortfolioSummary'

interface Config {
  goal: number
}

/** Edits the Net Worth Goal widget's target amount. */
export default function NetWorthGoalConfig({
  config,
  onConfigChange,
  onClose,
}: WidgetConfigProps<Config>) {
  const { data } = usePortfolioSummary()
  const currency = data?.currency ?? 'EUR'
  const [value, setValue] = useState(String(config.goal))

  const parsed = Number(value)
  const valid = Number.isFinite(parsed) && parsed > 0

  function save() {
    if (!valid) return
    onConfigChange({ ...config, goal: parsed })
    onClose()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      className="flex flex-col gap-3"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Target net worth ({currency})</span>
        <input
          type="number"
          min={1}
          step="any"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-9 rounded-md border border-border bg-panel-elevated px-3 text-sm tabular-nums text-foreground outline-none focus:border-border-accent"
        />
      </label>
      <p className="text-[11px] text-faint">The savings goal the widget tracks progress toward.</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={!valid}>
          Save
        </Button>
      </div>
    </form>
  )
}
