import 'server-only'
import { asc, eq } from 'drizzle-orm'
import type { MappedTransaction } from '@/lib/import/types'
import type { PersistTransaction } from '@/lib/import/trade-republic/importer'
import { getDb } from './index'
import { portfolios, transactions } from './schema'

/** Drizzle numeric columns are strings; convert prepared numbers (or null). */
function num(value: number | null): string | null {
  return value === null ? null : String(value)
}

/** A transaction row as read back for display + portfolio reconstruction. */
export interface TransactionRow {
  id: string
  type: string
  assetClass: string | null
  isin: string | null
  ticker: string | null
  quantity: string | null
  price: string | null
  amount: string | null
  fee: string | null
  tax: string | null
  currency: string
  date: string
  datetime: string
}

/** All of a user's transactions, oldest first. Scoped by user_id (RLS-equivalent). */
export async function getTransactionsForUser(userId: string): Promise<TransactionRow[]> {
  const db = getDb()
  return db
    .select({
      id: transactions.id,
      type: transactions.type,
      assetClass: transactions.assetClass,
      isin: transactions.isin,
      ticker: transactions.ticker,
      quantity: transactions.quantity,
      price: transactions.price,
      amount: transactions.amount,
      fee: transactions.fee,
      tax: transactions.tax,
      currency: transactions.currency,
      date: transactions.date,
      datetime: transactions.datetime,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(asc(transactions.datetime))
}

/**
 * Returns the user's default portfolio id, creating one on first import so
 * transactions always have a parent. Multi-portfolio selection comes later.
 */
export async function getOrCreateDefaultPortfolio(userId: string): Promise<string> {
  const db = getDb()

  const existing = await db
    .select({ id: portfolios.id })
    .from(portfolios)
    .where(eq(portfolios.userId, userId))
    .limit(1)

  if (existing[0]) return existing[0].id

  const [created] = await db
    .insert(portfolios)
    .values({ userId, name: 'My Portfolio', currency: 'EUR' })
    .returning({ id: portfolios.id })

  if (!created) throw new Error('Failed to create default portfolio')
  return created.id
}

/**
 * Builds a persist callback bound to one user + portfolio. Each call upserts a
 * single transaction with onConflictDoNothing on (user_id, broker, external_id):
 * re-importing the same file inserts nothing and reports every row as skipped.
 */
export function makePersist(userId: string, portfolioId: string): PersistTransaction {
  const db = getDb()

  return async (tx: MappedTransaction) => {
    const inserted = await db
      .insert(transactions)
      .values({
        portfolioId,
        userId,
        type: tx.type,
        assetClass: tx.assetClass,
        isin: tx.isin,
        ticker: tx.ticker,
        quantity: num(tx.quantity),
        price: num(tx.price),
        amount: num(tx.amount),
        fee: num(tx.fee),
        tax: num(tx.tax),
        currency: tx.currency,
        originalAmount: num(tx.originalAmount),
        originalCurrency: tx.originalCurrency,
        fxRate: num(tx.fxRate),
        date: tx.date,
        datetime: tx.datetime,
        broker: tx.broker,
        externalId: tx.externalId,
      })
      .onConflictDoNothing({
        target: [transactions.userId, transactions.broker, transactions.externalId],
      })
      .returning({ id: transactions.id })

    return inserted.length > 0 ? 'inserted' : 'skipped'
  }
}
