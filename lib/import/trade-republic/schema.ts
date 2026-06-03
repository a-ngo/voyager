import { z } from 'zod'

/**
 * Validates a single raw TR CSV row AFTER PII stripping.
 * PII columns (counterparty_name, counterparty_iban, payment_reference) are
 * stripped before this schema runs — they never appear here.
 */
export const TRRowSchema = z.object({
  datetime: z.string().datetime({ offset: true }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.string().min(1), // Validated against TR_TYPE_MAP downstream
  asset_class: z.string().optional(),
  symbol: z.string().optional(), // ISIN — optional for cash transactions
  shares: z.string().optional(),
  price: z.string().optional(),
  amount: z.string().optional(),
  fee: z.string().optional(),
  tax: z.string().optional(),
  currency: z.string().length(3), // ISO 4217 e.g. 'EUR'
  original_amount: z.string().optional(),
  original_currency: z.string().length(3).optional(),
  fx_rate: z.string().optional(),
  transaction_id: z.string().uuid(), // Required — deduplication key
})

export type TRRow = z.infer<typeof TRRowSchema>
