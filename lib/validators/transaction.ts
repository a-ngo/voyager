import { z } from 'zod'

/** Domain-level validators shared across API boundaries. */

export const TransactionTypeSchema = z.enum([
  'buy',
  'sell',
  'dividend',
  'deposit',
  'withdrawal',
  'fee',
  'reward',
  'tax_refund',
  'interest',
])

export const AssetClassSchema = z.enum(['stock', 'etf', 'bond', 'crypto', 'cash'])

export const BrokerSchema = z.enum(['trade_republic', 'scalable', 'ing', 'dkb', 'manual'])

export const TransactionSchema = z.object({
  type: TransactionTypeSchema,
  assetClass: AssetClassSchema.nullable(),
  isin: z.string().nullable(),
  ticker: z.string().nullable(),
  quantity: z.number().nullable(),
  price: z.number().nullable(),
  amount: z.number().nullable(),
  fee: z.number().nullable(),
  tax: z.number().nullable(),
  currency: z.string().length(3),
  originalAmount: z.number().nullable(),
  originalCurrency: z.string().length(3).nullable(),
  fxRate: z.number().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  datetime: z.string().datetime({ offset: true }),
  broker: BrokerSchema,
  externalId: z.string(),
})

export type Transaction = z.infer<typeof TransactionSchema>
