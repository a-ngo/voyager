/**
 * Two-line instrument cell: resolved name on top, ISIN beneath. The ISIN is
 * hidden when it would just repeat the name (unknown instruments). `name` is
 * resolved by the caller (curated map → price-source name → ticker → ISIN).
 */
export function InstrumentLabel({ name, isin }: { name: string; isin: string | null }) {
  const showIsin = !!isin && isin !== name

  return (
    <div className="flex flex-col">
      <span className="text-foreground">{name}</span>
      {showIsin && <span className="text-[10px] tabular-nums text-faint">{isin}</span>}
    </div>
  )
}
