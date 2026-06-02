/** Voyager's internal transaction type system (CLAUDE.md §6). */
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
  externalId: string
}

/** A row that failed validation or mapping, reported back to the user. */
export interface ImportError {
  row: number
  reason: string
}

/** Returned to the client so the user sees a clear summary (CLAUDE.md §8.5). */
export interface ImportResult {
  total: number
  imported: number
  skipped: number
  errors: ImportError[]
}
