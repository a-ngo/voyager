import { displayName } from '@/lib/prices/resolve'

/**
 * Two-line instrument cell: human-readable name on top, ISIN beneath. The ISIN
 * is hidden when it would just repeat the name (unknown instruments, where the
 * name falls back to the ISIN itself).
 */
export function InstrumentLabel({ isin, ticker }: { isin: string | null; ticker?: string | null }) {
  const name = displayName(isin, ticker ?? null)
  const showIsin = !!isin && isin !== name

  return (
    <div className="flex flex-col">
      <span className="text-foreground">{name}</span>
      {showIsin && <span className="text-[10px] tabular-nums text-faint">{isin}</span>}
    </div>
  )
}
