import type { TransactionType } from '../types'

/**
 * Maps Trade Republic transaction types to Voyager's internal type system.
 * If TR introduces an unknown type, the row is rejected and reported —
 * never silently dropped.
 */
export const TR_TYPE_MAP: Record<string, TransactionType> = {
  BUY: 'buy',
  SELL: 'sell',
  CUSTOMER_INBOUND: 'deposit',
  CUSTOMER_INPAYMENT: 'deposit',
  CUSTOMER_OUTBOUND: 'withdrawal',
  TRANSFER_INBOUND: 'deposit',
  TRANSFER_INSTANT_INBOUND: 'deposit',
  TRANSFER_OUTBOUND: 'withdrawal',
  TRANSFER_INSTANT_OUTBOUND: 'withdrawal',
  DIVIDEND: 'dividend',
  STOCKPERK: 'reward', // Free shares / cash promotions
  SPLIT: 'reward', // Stock split — adds shares, no cash (modeled as a reward)
  INTEREST: 'interest', // Savings interest
  INTEREST_PAYMENT: 'interest',
  SAVINGS_PLAN_EXECUTE: 'buy', // Scheduled savings plan buy
  TAX_REFUND: 'tax_refund',
  ROUND_UP: 'deposit',
  CARD_TRANSACTION: 'withdrawal',
  // TAX_OPTIMIZATION is sign-dependent (refund vs charge) and handled in the importer.
}

export function mapTrType(trType: string): TransactionType | null {
  return TR_TYPE_MAP[trType] ?? null
}
