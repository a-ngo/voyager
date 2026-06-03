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
    expect(result.total).toBe(7)
    expect(result.transactions).toHaveLength(7)
    expect(result.errors).toHaveLength(0)
  })

  it('maps Trade Republic types to Voyager types', () => {
    const { transactions } = prepareTradeRepublicImport(SAMPLE)
    const types = transactions.map((t) => t.type)
    expect(types).toContain('deposit') // CUSTOMER_INBOUND
    expect(types).toContain('buy') // BUY
    expect(types).toContain('reward') // STOCKPERK
  })

  it('captures the ISIN and leaves ticker unresolved', () => {
    const { transactions } = prepareTradeRepublicImport(SAMPLE)
    const buy = transactions.find((t) => t.type === 'buy')
    expect(buy?.isin).toBe('US70450Y1038')
    expect(buy?.ticker).toBeNull()
    expect(buy?.broker).toBe('trade_republic')
  })

  it('parses signed numeric amounts', () => {
    const { transactions } = prepareTradeRepublicImport(SAMPLE)
    const buy = transactions.find((t) => t.type === 'buy' && t.amount !== null)
    expect(buy?.amount).toBeLessThan(0) // buys are outflows
    expect(buy?.fee).toBe(-1)
  })
})

describe('PII stripping', () => {
  it('drops PII columns via the allowlist before mapping', () => {
    const raw = {
      type: 'BUY',
      counterparty_name: 'Jane Q Public',
      counterparty_iban: 'DE89370400440532013000',
      payment_reference: 'SECRET-REF-9000',
    }
    const sanitized = sanitizeRow(raw)
    for (const col of TR_PII_COLUMNS) {
      expect(col in sanitized).toBe(false)
    }
  })

  it('never lets PII values reach the mapped transactions', () => {
    const { transactions } = prepareTradeRepublicImport(PII)
    const serialized = JSON.stringify(transactions)
    expect(serialized).not.toContain('Jane Q Public')
    expect(serialized).not.toContain('DE89370400440532013000')
    expect(serialized).not.toContain('SECRET-REF-9000')
    expect(serialized).not.toContain('John Banker')
    expect(serialized).not.toContain('rent payment')
    // the legitimate transaction data is still present
    expect(serialized).toContain('US0378331005')
  })
})

describe('rejection handling', () => {
  it('rejects unknown TR types with a reported error, not a silent drop', () => {
    const { transactions, errors } = prepareTradeRepublicImport(INVALID)
    expect(errors.some((e) => e.reason.includes('TELEPORT'))).toBe(true)
    // the unknown-type row must not be mapped
    expect(transactions.some((t) => t.amount === 10)).toBe(false)
  })

  it('rejects malformed rows (invalid uuid) with the row number', () => {
    const { errors } = prepareTradeRepublicImport(INVALID)
    const uuidError = errors.find((e) => e.row === 3)
    expect(uuidError).toBeDefined()
  })

  it('mapTrType returns null for unknown types', () => {
    expect(mapTrType('BUY')).toBe('buy')
    expect(mapTrType('NONSENSE')).toBeNull()
  })
})

describe('idempotent import (deduplication)', () => {
  it('skips duplicates on re-import', async () => {
    const seen = new Set<string>()
    const persist: PersistTransaction = async (tx) => {
      if (seen.has(tx.externalId)) return 'skipped'
      seen.add(tx.externalId)
      return 'inserted'
    }

    const first = await importTradeRepublicCsv(SAMPLE, persist)
    expect(first.imported).toBe(7)
    expect(first.skipped).toBe(0)

    const second = await importTradeRepublicCsv(SAMPLE, persist)
    expect(second.imported).toBe(0)
    expect(second.skipped).toBe(7)
  })
})
