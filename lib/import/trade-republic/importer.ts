import type { AssetClass, ImportError, ImportResult, MappedTransaction } from '../types'
import { parseCsv } from './parse-csv'
import { sanitizeRow, TR_ALLOWED_COLUMNS, type TRAllowedColumn } from './sanitize'
import { TRRowSchema } from './schema'
import { mapTrType } from './type-map'

const KNOWN_ASSET_CLASSES: Record<string, AssetClass> = {
  stock: 'stock',
  etf: 'etf',
  fund: 'etf',
  bond: 'bond',
  crypto: 'crypto',
  cash: 'cash',
}

function parseNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function mapAssetClass(value: string | undefined): AssetClass | null {
  if (!value) return null
  return KNOWN_ASSET_CLASSES[value.toLowerCase()] ?? null
}

/** Convert allowlisted empty strings to undefined so optional Zod fields pass. */
function nullifyEmpty(row: Record<TRAllowedColumn, string>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const col of TR_ALLOWED_COLUMNS) {
    const value = row[col]
    out[col] = value === '' ? undefined : value
  }
  return out
}

export interface PreparedImport {
  total: number
  transactions: MappedTransaction[]
  errors: ImportError[]
}

/**
 * Pure: parse → strip PII (allowlist) → validate → map TR types to Voyager types.
 * No DB, no fetch — fully unit-testable with CSV fixtures (CLAUDE.md §8.1, §10).
 * Rows that fail validation or carry an unknown TR type are reported, not dropped.
 */
export function prepareTradeRepublicImport(csvText: string): PreparedImport {
  const { rows } = parseCsv(csvText)
  const transactions: MappedTransaction[] = []
  const errors: ImportError[] = []

  rows.forEach((rawRow, index) => {
    const rowNumber = index + 2 // +1 for header, +1 for 1-based display

    const sanitized = sanitizeRow(rawRow) // PII + unknown columns dropped here
    const normalized = nullifyEmpty(sanitized)

    const parsed = TRRowSchema.safeParse(normalized)
    if (!parsed.success) {
      const reason = parsed.error.issues[0]?.message ?? 'Invalid row'
      errors.push({ row: rowNumber, reason })
      return
    }

    const tr = parsed.data
    const type = mapTrType(tr.type)
    if (!type) {
      errors.push({ row: rowNumber, reason: `Unknown Trade Republic type: ${tr.type}` })
      return
    }

    transactions.push({
      type,
      assetClass: mapAssetClass(tr.asset_class),
      isin: tr.symbol ?? null,
      ticker: null, // resolved lazily via OpenFIGI after import (CLAUDE.md §8.4)
      quantity: parseNumber(tr.shares),
      price: parseNumber(tr.price),
      amount: parseNumber(tr.amount),
      fee: parseNumber(tr.fee),
      tax: parseNumber(tr.tax),
      currency: tr.currency,
      originalAmount: parseNumber(tr.original_amount),
      originalCurrency: tr.original_currency ?? null,
      fxRate: parseNumber(tr.fx_rate),
      date: tr.date,
      datetime: tr.datetime,
      broker: 'trade_republic',
      externalId: tr.transaction_id,
    })
  })

  return { total: rows.length, transactions, errors }
}

/** Persists one transaction. Returns whether it was newly inserted or a duplicate. */
export type PersistTransaction = (tx: MappedTransaction) => Promise<'inserted' | 'skipped'>

/**
 * Orchestrates a full import. The `persist` callback owns the DB upsert with
 * `onConflictDoNothing` on (user_id, broker, external_id) for idempotency
 * (CLAUDE.md §8.5). Keeping persistence injected means this stays testable.
 */
export async function importTradeRepublicCsv(
  csvText: string,
  persist: PersistTransaction,
): Promise<ImportResult> {
  const prepared = prepareTradeRepublicImport(csvText)

  const outcomes = await Promise.allSettled(prepared.transactions.map((tx) => persist(tx)))

  let imported = 0
  let skipped = 0
  const errors: ImportError[] = [...prepared.errors]

  outcomes.forEach((outcome, i) => {
    if (outcome.status === 'fulfilled') {
      if (outcome.value === 'inserted') imported++
      else skipped++
    } else {
      errors.push({ row: i + 2, reason: 'Failed to persist transaction' })
    }
  })

  return { total: prepared.total, imported, skipped, errors }
}
