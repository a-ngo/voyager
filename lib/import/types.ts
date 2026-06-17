/** Voyager's internal transaction type system. */
export type TransactionType =
  | 'buy'
  | 'sell'
  | 'dividend'
  | 'deposit'
  | 'withdrawal'
  | 'fee'
  | 'reward'
  | 'tax_refund'
  | 'interest'

export type AssetClass = 'stock' | 'etf' | 'bond' | 'crypto' | 'cash'

export type Broker = 'trade_republic' | 'scalable' | 'ing' | 'dkb' | 'manual'

/** A transaction ready to be upserted into the ledger. PII never reaches here. */
export interface MappedTransaction {
  type: TransactionType
  assetClass: AssetClass | null
  isin: string | null
  ticker: string | null
  name: string | null
  quantity: number | null
  price: number | null
  amount: number | null
  fee: number | null
  tax: number | null
  currency: string
  originalAmount: number | null
  originalCurrency: string | null
  fxRate: number | null
  date: string
  datetime: string
  broker: Broker
  /** Primary dedup key: the broker's transaction id when available, else content-derived. */
  externalId: string
  /**
   * Content-derived dedup key, kept alongside `externalId` so a row that was
   * imported under the old (content-only) scheme is still recognized as a
   * duplicate after the broker id became the primary key. Undefined when the
   * primary key already is the content key.
   */
  legacyExternalId?: string | null
}

/** A row that failed validation or mapping, reported back to the user. */
export interface ImportError {
  row: number
  reason: string
}

/** Returned to the client so the user sees a clear summary. */
export interface ImportResult {
  total: number
  imported: number
  skipped: number
  /** Rows intentionally not imported because their type is ignored (e.g. IPO subscriptions). */
  ignored: number
  errors: ImportError[]
}
