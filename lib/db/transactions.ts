import 'server-only'
import { eq } from 'drizzle-orm'
import type { MappedTransaction } from '@/lib/import/types'
import type { PersistTransaction } from '@/lib/import/trade-republic/importer'
import { getDb } from './index'
import { portfolios, transactions } from './schema'

/** Drizzle numeric columns are strings; convert prepared numbers (or null). */
function num(value: number | null): string | null {
  return value === null ? null : String(value)
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
