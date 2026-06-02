import type { TransactionType } from '../types'

/**
 * Maps Trade Republic transaction types to Voyager's internal type system.
 * If TR introduces an unknown type, the row is rejected and reported —
 * never silently dropped (CLAUDE.md §8.3).
 */
export const TR_TYPE_MAP: Record<string, TransactionType> = {
  BUY: 'buy',
  SELL: 'sell',
  CUSTOMER_INBOUND: 'deposit',
  CUSTOMER_OUTBOUND: 'withdrawal',
  DIVIDEND: 'dividend',
  STOCKPERK: 'reward', // Free shares promotions
  INTEREST: 'interest', // Savings interest
  SAVINGS_PLAN_EXECUTE: 'buy', // Scheduled savings plan buy
  TAX_REFUND: 'tax_refund',
  ROUND_UP: 'deposit',
  CARD_TRANSACTION: 'withdrawal',
}

export function mapTrType(trType: string): TransactionType | null {
  return TR_TYPE_MAP[trType] ?? null
}
