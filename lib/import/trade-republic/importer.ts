import type { AssetClass, ImportError, ImportResult, MappedTransaction } from '../types'
import { parseCsv } from './parse-csv'
import { sanitizeRow, TR_ALLOWED_COLUMNS, type TRAllowedColumn } from './sanitize'
import { TRRowSchema, type TRRow } from './schema'
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
  /** Rows skipped because their TR type is intentionally ignored (e.g. IPO subscriptions). */
  ignored: number
  errors: ImportError[]
}

/**
 * Pure: parse → strip PII (allowlist) → validate → map TR types to Voyager types.
 * No DB, no fetch — fully unit-testable with CSV fixtures.
 * Rows that fail validation or carry an unknown TR type are reported, not dropped;
 * rows of an intentionally ignored type are counted in `ignored`, not errored.
 */
export function prepareTradeRepublicImport(csvText: string): PreparedImport {
  const { rows } = parseCsv(csvText)
  const transactions: MappedTransaction[] = []
  const errors: ImportError[] = []
  let ignored = 0

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
    const contentKey = dedupKey(tr)
    // Prefer the broker's transaction id; fall back to the content key. Keep the
    // content key as the legacy key so rows imported before the id was adopted
    // are still recognized as duplicates.
    const externalId = tr.transaction_id ?? contentKey
    const sharesNum = parseNumber(tr.shares)
    const priceNum = parseNumber(tr.price)

    // IPO_SUBSCRIPTION: a cash pre-payment/refund pair reserving money for an IPO.
    // The reserved cash is represented by the eventual BUY (whose row carries
    // shares + price but no amount — reconstructed below), so the reserved amount
    // is dropped here. Only the subscription access fee is kept, as a fee; rows
    // without a fee (e.g. the refund) are counted as ignored.
    if (tr.type === 'IPO_SUBSCRIPTION') {
      const feeValue = parseNumber(tr.fee)
      if (feeValue != null && feeValue !== 0) {
        transactions.push({
          type: 'fee',
          assetClass: mapAssetClass(tr.asset_class),
          isin: tr.symbol ?? null,
          ticker: null,
          name: cleanName(tr.name),
          quantity: null,
          price: null,
          amount: 0,
          fee: feeValue,
          tax: null,
          currency: tr.currency ?? 'EUR',
          originalAmount: null,
          originalCurrency: null,
          fxRate: null,
          date: tr.date,
          datetime: tr.datetime,
          broker: 'trade_republic',
          externalId,
          legacyExternalId: contentKey,
        })
      } else {
        ignored += 1
      }
      return
    }

    // TAX_OPTIMIZATION carries its cash in the (signed) tax column, not amount:
    // positive = refund (cash in), negative = charge (cash out). Normalize it so
    // the type-driven engine handles the direction.
    let type: ReturnType<typeof mapTrType>
    let amount = parseNumber(tr.amount)
    let tax = parseNumber(tr.tax)
    if (tr.type === 'TAX_OPTIMIZATION') {
      const taxValue = parseNumber(tr.tax) ?? 0
      type = taxValue >= 0 ? 'tax_refund' : 'fee'
      amount = taxValue // engine takes the magnitude; the type carries the sign
      tax = null
    } else {
      type = mapTrType(tr.type)
    }

    if (!type) {
      errors.push({ row: rowNumber, reason: `Unknown Trade Republic type: ${tr.type}` })
      return
    }

    // Reconstruct a trade's cash amount when the export omits it (e.g. an IPO fill
    // whose cash settled via the subscription pre-payments): without this the cost
    // basis would be booked as zero.
    if ((type === 'buy' || type === 'sell') && amount === null && sharesNum !== null && priceNum !== null) {
      amount = -(sharesNum * priceNum)
    }

    transactions.push({
      type,
      assetClass: mapAssetClass(tr.asset_class),
      isin: tr.symbol ?? null,
      ticker: null, // resolved lazily via OpenFIGI after import
      name: cleanName(tr.name),
      quantity: sharesNum,
      price: priceNum,
      amount,
      fee: parseNumber(tr.fee),
      tax,
      currency: tr.currency ?? 'EUR',
      originalAmount: parseNumber(tr.original_amount),
      originalCurrency: tr.original_currency ?? null,
      fxRate: parseNumber(tr.fx_rate),
      date: tr.date,
      datetime: tr.datetime,
      broker: 'trade_republic',
      externalId,
      legacyExternalId: contentKey,
    })
  })

  return { total: rows.length, transactions, ignored, errors }
}

/** Trim the instrument name; blank/whitespace becomes null. */
function cleanName(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/**
 * Content-based dedup key — the fallback when the export omits a transaction id.
 * Each export is cumulative, so a transaction is identified by its immutable
 * content (time + instrument + size). Re-importing the same or a later export
 * skips rows already seen (idempotent), keyed via UNIQUE (user_id, broker,
 * external_id). When the broker supplies a transaction id, that is used as the
 * primary key instead and this becomes the `legacyExternalId`.
 */
function dedupKey(tr: TRRow): string {
  return [tr.datetime, tr.type, tr.symbol ?? '', tr.shares ?? '', tr.amount ?? '', tr.tax ?? '']
    .join('|')
}

/** Persists one transaction. Returns whether it was newly inserted or a duplicate. */
export type PersistTransaction = (tx: MappedTransaction) => Promise<'inserted' | 'skipped'>

/**
 * Orchestrates a full import. The `persist` callback owns the DB upsert with
 * `onConflictDoNothing` on (user_id, broker, external_id) for idempotency.
 * Keeping persistence injected means this stays testable.
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

  return { total: prepared.total, imported, skipped, ignored: prepared.ignored, errors }
}
