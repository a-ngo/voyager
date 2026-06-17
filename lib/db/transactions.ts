import 'server-only'
import { and, asc, eq } from 'drizzle-orm'
import type { MappedTransaction } from '@/lib/import/types'
import type { PersistTransaction } from '@/lib/import/trade-republic/importer'
import { getDb } from './index'
import { portfolios, transactions } from './schema'

/** Drizzle numeric columns are strings; convert prepared numbers (or null). */
function num(value: number | null): string | null {
  return value === null ? null : String(value)
}

/**
 * Wipes the user's portfolio data — all transactions and portfolios (alerts
 * cascade) — so they can re-import from scratch. Shared market data (price_cache,
 * isin_ticker_map) and dashboard layout are left intact. Scoped by user_id.
 */
export async function deleteUserPortfolioData(userId: string): Promise<{ transactions: number }> {
  const db = getDb()
  const removed = await db
    .delete(transactions)
    .where(eq(transactions.userId, userId))
    .returning({ id: transactions.id })
  await db.delete(portfolios).where(eq(portfolios.userId, userId))
  return { transactions: removed.length }
}

/** The user's default-portfolio target allocations (bucket → percent), or {}. */
export async function getTargetAllocations(userId: string): Promise<Record<string, number>> {
  const db = getDb()
  const [row] = await db
    .select({ targets: portfolios.targetAllocations })
    .from(portfolios)
    .where(eq(portfolios.userId, userId))
    .limit(1)
  return (row?.targets as Record<string, number> | null) ?? {}
}

/** Save target allocations on the user's default portfolio (created if needed). */
export async function setTargetAllocations(
  userId: string,
  targets: Record<string, number>,
): Promise<void> {
  const db = getDb()
  const portfolioId = await getOrCreateDefaultPortfolio(userId)
  await db.update(portfolios).set({ targetAllocations: targets }).where(eq(portfolios.id, portfolioId))
}

/** A transaction row as read back for display + portfolio reconstruction. */
export interface TransactionRow {
  id: string
  type: string
  assetClass: string | null
  isin: string | null
  ticker: string | null
  name: string | null
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
      name: transactions.name,
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
 * Builds a persist callback bound to one user + broker + portfolio. Loads the
 * user's existing external_ids for the broker once, then dedups each incoming
 * row against BOTH its primary key (the broker's transaction id) and its
 * `legacyExternalId` (content-derived) — so a row imported under the old
 * content-only scheme is still recognized after the transaction id became the
 * primary key, and nothing double-imports across the cutover. `onConflictDoNothing`
 * remains the backstop against races and within-batch collisions.
 */
export async function makePersist(
  userId: string,
  portfolioId: string,
  broker: MappedTransaction['broker'] = 'trade_republic',
): Promise<PersistTransaction> {
  const db = getDb()

  const existingRows = await db
    .select({ externalId: transactions.externalId })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.broker, broker)))
  const seen = new Set(existingRows.map((r) => r.externalId).filter((id): id is string => !!id))

  return async (tx: MappedTransaction) => {
    if (seen.has(tx.externalId) || (tx.legacyExternalId != null && seen.has(tx.legacyExternalId))) {
      return 'skipped'
    }

    const inserted = await db
      .insert(transactions)
      .values({
        portfolioId,
        userId,
        type: tx.type,
        assetClass: tx.assetClass,
        isin: tx.isin,
        ticker: tx.ticker,
        name: tx.name,
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

    if (inserted.length > 0) {
      seen.add(tx.externalId)
      return 'inserted'
    }
    return 'skipped'
  }
}
