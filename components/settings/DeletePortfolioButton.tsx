'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DeletePortfolioButton() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const [status, setStatus] = useState<'idle' | 'deleting' | 'done' | 'error'>('idle')

  async function remove() {
    setStatus('deleting')
    try {
      const res = await fetch('/api/portfolio', { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setStatus('done')
      setConfirming(false)
      queryClient.invalidateQueries() // dashboard widgets refetch (now empty)
      router.refresh() // re-render server pages (Settings, Portfolio, …)
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-positive">
        <Check className="h-3.5 w-3.5" /> Portfolio deleted. Import a CSV to start fresh.
      </p>
    )
  }

  if (!confirming) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setConfirming(true)}
        className="border-negative/40 text-negative hover:bg-negative/10"
      >
        <Trash2 className="h-4 w-4" /> Delete portfolio &amp; transactions
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-negative">
        This permanently deletes all your transactions and resets the portfolio. It cannot be
        undone.
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={remove}
          disabled={status === 'deleting'}
          className="bg-negative text-primary-foreground hover:bg-negative/90"
        >
          {status === 'deleting' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Yes, delete everything
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={status === 'deleting'}>
          Cancel
        </Button>
      </div>
      {status === 'error' && <span className="text-xs text-negative">Couldn&apos;t delete. Try again.</span>}
    </div>
  )
}
