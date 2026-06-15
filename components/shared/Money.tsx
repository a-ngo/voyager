import { formatMoney } from '@/lib/utils/format'

/**
 * A monetary amount that blurs when "anonymize amounts" is on. Presentational
 * and SSR-safe — masking is pure CSS (`.anon-amount` under `[data-anon='1']`),
 * so no hooks/context. Use this for every absolute € figure; leave percentages
 * and counts as plain text so they stay visible.
 */
export function Money({
  value,
  currency = 'EUR',
  className,
}: {
  value: number
  currency?: string
  className?: string
}) {
  return (
    <span className={className ? `anon-amount ${className}` : 'anon-amount'}>
      {formatMoney(value, currency)}
    </span>
  )
}
