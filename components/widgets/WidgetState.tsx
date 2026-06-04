/** Centered message for widget loading/error/empty states. */
export function WidgetMessage({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center px-2 text-center text-xs text-faint">
      {text}
    </div>
  )
}

/** Marks a widget still backed by sample data (feature not wired to real data yet). */
export function SampleBadge() {
  return (
    <span className="pointer-events-none absolute right-1 top-1 z-10 rounded bg-panel-elevated px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-faint">
      Sample
    </span>
  )
}
