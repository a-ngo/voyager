import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  prepareTradeRepublicImport,
  importTradeRepublicCsv,
  type PersistTransaction,
} from '@/lib/import/trade-republic/importer'
import { sanitizeRow, TR_PII_COLUMNS } from '@/lib/import/trade-republic/sanitize'
import { mapTrType } from '@/lib/import/trade-republic/type-map'

function fixture(name: string): string {
  const path = fileURLToPath(new URL(`../../fixtures/${name}`, import.meta.url))
  return readFileSync(path, 'utf-8')
}

const SAMPLE = fixture('trade-republic-sample.csv')
const PII = fixture('trade-republic-pii.csv')
const INVALID = fixture('trade-republic-invalid.csv')

describe('prepareTradeRepublicImport — happy path', () => {
  it('maps every row of the sample export with no errors', () => {
    const result = prepareTradeRepublicImport(SAMPLE)
    expect(result.total).toBe(10)
    expect(result.transactions).toHaveLength(10)
    expect(result.errors).toHaveLength(0)
  })

  it('maps Trade Republic types — including the new ones', () => {
    const types = prepareTradeRepublicImport(SAMPLE).transactions.map((t) => t.type)
    expect(types).toContain('deposit') // CUSTOMER_INBOUND
    expect(types).toContain('buy') // BUY / SAVINGS_PLAN_EXECUTE
    expect(types).toContain('sell') // SELL
    expect(types).toContain('reward') // STOCKPERK / SPLIT
    expect(types).toContain('interest') // INTEREST_PAYMENT
    expect(types).toContain('dividend') // DIVIDEND
    expect(types).toContain('withdrawal') // TRANSFER_OUTBOUND
  })

  it('captures the ISIN and the broker-provided name', () => {
    const { transactions } = prepareTradeRepublicImport(SAMPLE)
    const stockBuy = transactions.find((t) => t.type === 'buy' && t.isin === 'TESTSTK00001')
    expect(stockBuy?.name).toBe('Testco Inc')
    expect(stockBuy?.ticker).toBeNull()
    expect(stockBuy?.broker).toBe('trade_republic')
  })

  it('keeps the (negative) sell share sign from the export', () => {
    const { transactions } = prepareTradeRepublicImport(SAMPLE)
    const sell = transactions.find((t) => t.type === 'sell')
    expect(sell?.quantity).toBeLessThan(0)
    expect(sell?.amount).toBeGreaterThan(0) // proceeds are an inflow
  })

  it('normalizes TAX_OPTIMIZATION (cash in the tax column) by sign', () => {
    const { transactions } = prepareTradeRepublicImport(SAMPLE)
    // -12.50 in the tax column → a charge, modeled as a fee carrying the amount
    const taxOpt = transactions.find((t) => t.type === 'fee')
    expect(taxOpt?.amount).toBeCloseTo(-12.5)
  })

  it('blank instrument names become null', () => {
    const { transactions } = prepareTradeRepublicImport(SAMPLE)
    const deposit = transactions.find((t) => t.type === 'deposit')
    expect(deposit?.name).toBeNull()
  })
})

describe('PII stripping', () => {
  it('drops PII columns via the allowlist before mapping', () => {
    const sanitized = sanitizeRow({
      type: 'BUY',
      counterparty_name: 'Jane Q Public',
      counterparty_iban: 'DE89370400440532013000',
      payment_reference: 'SECRET-REF-9000',
    })
    for (const col of TR_PII_COLUMNS) {
      expect(col in sanitized).toBe(false)
    }
  })

  it('never lets PII values reach the mapped transactions', () => {
    const serialized = JSON.stringify(prepareTradeRepublicImport(PII).transactions)
    expect(serialized).not.toContain('Jane Q Public')
    expect(serialized).not.toContain('DE89370400440532013000')
    expect(serialized).not.toContain('SECRET-REF-9000')
    expect(serialized).not.toContain('John Banker')
    expect(serialized).not.toContain('rent payment')
    expect(serialized).toContain('TESTSTK00001') // legitimate data survives
  })
})

describe('rejection handling', () => {
  it('rejects unknown TR types with a reported error, not a silent drop', () => {
    const { transactions, errors } = prepareTradeRepublicImport(INVALID)
    expect(errors.some((e) => e.reason.includes('TELEPORT'))).toBe(true)
    expect(transactions.some((t) => t.amount === 10)).toBe(false)
  })

  it('rejects malformed rows (bad datetime) with the row number', () => {
    const { errors } = prepareTradeRepublicImport(INVALID)
    expect(errors.find((e) => e.row === 3)).toBeDefined()
  })

  it('mapTrType resolves known types and rejects unknown ones', () => {
    expect(mapTrType('SAVINGS_PLAN_EXECUTE')).toBe('buy')
    expect(mapTrType('INTEREST_PAYMENT')).toBe('interest')
    expect(mapTrType('TRANSFER_OUTBOUND')).toBe('withdrawal')
    expect(mapTrType('NONSENSE')).toBeNull()
  })
})

describe('content-based deduplication', () => {
  it('derives a stable key from immutable content (no transaction id needed)', () => {
    const a = prepareTradeRepublicImport(SAMPLE).transactions
    const b = prepareTradeRepublicImport(SAMPLE).transactions
    expect(a.map((t) => t.externalId)).toEqual(b.map((t) => t.externalId))
    expect(new Set(a.map((t) => t.externalId)).size).toBe(a.length) // all distinct
  })

  it('skips duplicates on re-import (idempotent across cumulative exports)', async () => {
    const seen = new Set<string>()
    const persist: PersistTransaction = async (tx) => {
      if (seen.has(tx.externalId)) return 'skipped'
      seen.add(tx.externalId)
      return 'inserted'
    }

    const first = await importTradeRepublicCsv(SAMPLE, persist)
    expect(first.imported).toBe(10)
    expect(first.skipped).toBe(0)

    const second = await importTradeRepublicCsv(SAMPLE, persist)
    expect(second.imported).toBe(0)
    expect(second.skipped).toBe(10)
  })
})

const HEADER =
  'datetime;date;type;transaction_id;asset_class;name;symbol;shares;price;amount;fee;tax;currency;original_amount;original_currency;fx_rate'

/** One BUY row carrying a broker transaction id. */
function withTxnId(txnId = 'tr-abc-123'): string {
  return `${HEADER}\n2024-01-10T10:00:00+00:00;2024-01-10;BUY;${txnId};stock;Test Stock;TESTSTK00001;10;100;-1000;;;EUR;;;`
}

const CONTENT_KEY = '2024-01-10T10:00:00+00:00|BUY|TESTSTK00001|10|-1000|'

describe('transaction-id deduplication', () => {
  it('uses the broker transaction id as the key, keeping the content key as legacy', () => {
    const [t] = prepareTradeRepublicImport(withTxnId()).transactions
    expect(t!.externalId).toBe('tr-abc-123')
    expect(t!.legacyExternalId).toBe(CONTENT_KEY)
  })

  it('falls back to the content key when no transaction id is present', () => {
    const [t] = prepareTradeRepublicImport(SAMPLE).transactions
    expect(t!.externalId).toBe(t!.legacyExternalId) // primary == content key
  })

  // Mirrors makePersist's dual-key check: skip if EITHER key is already known.
  function dualKeyPersist(seen: Set<string>): PersistTransaction {
    return async (tx) => {
      if (seen.has(tx.externalId) || (tx.legacyExternalId != null && seen.has(tx.legacyExternalId))) {
        return 'skipped'
      }
      seen.add(tx.externalId)
      return 'inserted'
    }
  }

  it('does not re-import a row already stored under the old content-only scheme', async () => {
    // The trade is already in the DB keyed by its content hash (pre-cutover).
    const seen = new Set<string>([CONTENT_KEY])
    const res = await importTradeRepublicCsv(withTxnId(), dualKeyPersist(seen))
    expect(res.imported).toBe(0)
    expect(res.skipped).toBe(1)
  })

  it('is idempotent on re-import once keyed by transaction id', async () => {
    const seen = new Set<string>()
    const persist = dualKeyPersist(seen)
    expect((await importTradeRepublicCsv(withTxnId(), persist)).imported).toBe(1)
    expect((await importTradeRepublicCsv(withTxnId(), persist)).skipped).toBe(1)
  })
})

/**
 * A real IPO subscription episode: a cash pre-payment (with access fee), a
 * partial refund, then the BUY for the filled shares (no amount on the row).
 */
function ipoSubscriptionEpisode(): string {
  return [
    HEADER,
    '2026-06-08T09:00:00+00:00;2026-06-08;IPO_SUBSCRIPTION;ipo-prepay;stock;SpaceX;US84615Q1031;;;-1429.09;-1.00;;EUR;;;',
    '2026-06-12T09:00:00+00:00;2026-06-12;IPO_SUBSCRIPTION;ipo-refund;stock;SpaceX;US84615Q1031;;;1244.28;;;EUR;;;',
    '2026-06-12T10:00:00+00:00;2026-06-12;BUY;ipo-buy;stock;SpaceX;US84615Q1031;1.582812;116.762806;;;;EUR;;;',
  ].join('\n')
}

describe('IPO subscription handling', () => {
  it('drops the reserved cash, keeps the access fee, and reconstructs the BUY amount', () => {
    const { transactions, ignored, errors } = prepareTradeRepublicImport(ipoSubscriptionEpisode())
    expect(errors).toHaveLength(0)
    expect(ignored).toBe(1) // the refund row (no fee) is ignored
    expect(transactions).toHaveLength(2) // the access fee + the BUY

    const fee = transactions.find((t) => t.type === 'fee')!
    expect(fee.fee).toBeCloseTo(-1, 6)
    expect(fee.amount).toBe(0) // reserved cash dropped; only the fee remains
    expect(fee.isin).toBe('US84615Q1031')

    const buy = transactions.find((t) => t.type === 'buy')!
    expect(buy.quantity).toBeCloseTo(1.582812, 6)
    // amount reconstructed from shares × price → correct cost basis downstream
    expect(buy.amount).toBeCloseTo(-(1.582812 * 116.762806), 4)
  })

  it('net cash and shares reconcile end-to-end', async () => {
    const persist: PersistTransaction = async () => 'inserted'
    const res = await importTradeRepublicCsv(ipoSubscriptionEpisode(), persist)
    expect(res.total).toBe(3)
    expect(res.imported).toBe(2) // fee + buy
    expect(res.ignored).toBe(1) // refund
    expect(res.errors).toHaveLength(0)
  })

  it('reconstructs a trade amount from shares × price only when the export omits it', () => {
    const csv = `${HEADER}\n2026-01-01T09:00:00+00:00;2026-01-01;BUY;id1;stock;X;ISIN00000001;2;50;;;;EUR;;;`
    const [t] = prepareTradeRepublicImport(csv).transactions
    expect(t!.amount).toBeCloseTo(-100, 6) // 2 × 50, cash out
  })
})
