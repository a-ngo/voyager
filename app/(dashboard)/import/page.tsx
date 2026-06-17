'use client'

import { useRef, useState } from 'react'
import { Upload, FileCheck2, Loader2, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ImportError {
  row: number
  reason: string
}
interface ImportResult {
  total: number
  imported: number
  skipped: number
  ignored: number
  errors: ImportError[]
}

const MAX_FILE_SIZE = 5 * 1024 * 1024

export default function ImportPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  async function handleFile(file: File) {
    setMessage(null)
    setResult(null)

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setStatus('error')
      setMessage('Please select a .csv file.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setStatus('error')
      setMessage('File exceeds the 5MB limit.')
      return
    }

    setFileName(file.name)
    setStatus('uploading')

    const body = new FormData()
    body.append('file', file)

    try {
      const res = await fetch('/api/import/trade-republic', { method: 'POST', body })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? 'Import failed')
      }
      const data = (await res.json()) as ImportResult
      setResult(data)
      setStatus('done')
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Import failed')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Import"
        description="Upload a Trade Republic CSV export. PII is stripped server-side before anything is stored."
      />

      <Card>
        <CardHeader>
          <CardTitle>Trade Republic</CardTitle>
        </CardHeader>
        <CardContent>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
            }}
          />

          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const file = e.dataTransfer.files?.[0]
              if (file) void handleFile(file)
            }}
            className="flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-border-accent bg-panel-elevated px-6 py-10 text-center transition-colors hover:border-brand"
          >
            {status === 'uploading' ? (
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
            ) : (
              <Upload className="h-6 w-6 text-brand" />
            )}
            <span className="text-sm text-foreground">
              {status === 'uploading' ? 'Importing…' : 'Drop CSV here or click to browse'}
            </span>
            <span className="text-xs text-faint">Semicolon-delimited · UTF-8 · max 5MB</span>
          </div>

          {fileName && status !== 'error' && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
              <FileCheck2 className="h-3.5 w-3.5" /> {fileName}
            </p>
          )}

          {status === 'error' && message && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-negative">
              <AlertTriangle className="h-3.5 w-3.5" /> {message}
            </p>
          )}

          <div className="mt-3">
            <Button variant="brand" size="sm" onClick={() => inputRef.current?.click()}>
              <Upload className="h-4 w-4" /> Choose file
            </Button>
          </div>
        </CardContent>
      </Card>

      {status === 'done' && result && (
        <Card>
          <CardHeader>
            <CardTitle>Import summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Imported" value={result.imported} tone="positive" />
              <Stat label="Skipped" value={result.skipped} tone="muted" />
              <Stat label="Ignored" value={result.ignored} tone="muted" />
              <Stat label="Errors" value={result.errors.length} tone="negative" />
            </div>
            <p className="mt-3 text-xs text-muted">
              {result.imported} transactions imported, {result.skipped} already existed and were
              skipped, {result.errors.length} errors
              {result.ignored > 0 &&
                `, ${result.ignored} ignored (IPO subscription cash entries, represented by the resulting trade)`}
              .
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1 text-xs text-negative">
                {result.errors.slice(0, 10).map((e) => (
                  <li key={`${e.row}-${e.reason}`}>
                    Row {e.row}: {e.reason}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'positive' | 'negative' | 'muted'
}) {
  const color =
    tone === 'positive' ? 'text-positive' : tone === 'negative' ? 'text-negative' : 'text-muted'
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-panel-elevated p-3">
      <div className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-faint">{label}</div>
    </div>
  )
}
