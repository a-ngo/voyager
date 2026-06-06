/**
 * PII hard-strip + column allowlist for Trade Republic imports.
 *
 * The importer must EXPLICITLY allowlist columns. Unknown or new columns default
 * to skipped — this future-proofs against TR adding new PII columns.
 */

/** Columns we keep. Everything else is dropped before anything touches the DB. */
export const TR_ALLOWED_COLUMNS = [
  'datetime',
  'date',
  'type',
  'asset_class',
  'name',
  'symbol',
  'shares',
  'price',
  'amount',
  'fee',
  'tax',
  'currency',
  'original_amount',
  'original_currency',
  'fx_rate',
] as const

/** Columns that carry PII and must never be stored or logged. */
export const TR_PII_COLUMNS = [
  'counterparty_name',
  'counterparty_iban',
  'payment_reference',
] as const

export type TRAllowedColumn = (typeof TR_ALLOWED_COLUMNS)[number]

/**
 * Keep only allowlisted columns. PII and unknown columns are dropped entirely —
 * they never appear in the output object, so they cannot be persisted or logged.
 */
export function sanitizeRow(raw: Record<string, string>): Record<TRAllowedColumn, string> {
  const out = {} as Record<TRAllowedColumn, string>
  for (const col of TR_ALLOWED_COLUMNS) {
    out[col] = raw[col] ?? ''
  }
  return out
}
