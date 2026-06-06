import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Drizzle schema. Mirrors supabase/migrations/0001_init.sql — the migration is
 * the source of truth for what runs in Postgres; this file is the typed view
 * Drizzle queries against. Keep the two in sync when the schema changes.
 *
 * user_id columns reference auth.users(id) in the database. Drizzle does not
 * model the auth schema, so the FK lives only in the migration; queries here
 * must always scope by user_id manually (this connection bypasses RLS).
 */

export const portfolios = pgTable('portfolios', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  name: text('name').notNull(),
  currency: text('currency').notNull().default('EUR'),
  targetAllocations: jsonb('target_allocations'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
})

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    portfolioId: uuid('portfolio_id')
      .notNull()
      .references(() => portfolios.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),

    type: text('type').notNull(),
    assetClass: text('asset_class'),

    isin: text('isin'),
    ticker: text('ticker'),
    name: text('name'),

    quantity: numeric('quantity'),
    price: numeric('price'),
    amount: numeric('amount'),
    fee: numeric('fee'),
    tax: numeric('tax'),

    currency: text('currency').notNull(),
    originalAmount: numeric('original_amount'),
    originalCurrency: text('original_currency'),
    fxRate: numeric('fx_rate'),

    date: date('date', { mode: 'string' }).notNull(),
    datetime: timestamp('datetime', { withTimezone: true, mode: 'string' }).notNull(),

    broker: text('broker'),
    externalId: text('external_id'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // Idempotent re-import key — matches transactions_external_id_unique in the migration.
    externalIdUnique: unique('transactions_external_id_unique').on(
      t.userId,
      t.broker,
      t.externalId,
    ),
  }),
)

export const isinTickerMap = pgTable('isin_ticker_map', {
  isin: text('isin').primaryKey(),
  ticker: text('ticker').notNull(),
  exchange: text('exchange'),
  name: text('name'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
  source: text('source').notNull().default('openfigi'),
})

export const priceCache = pgTable(
  'price_cache',
  {
    ticker: text('ticker').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    open: numeric('open'),
    high: numeric('high'),
    low: numeric('low'),
    close: numeric('close'),
    volume: numeric('volume'),
    currency: text('currency'),
    source: text('source'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: unique('price_cache_pkey').on(t.ticker, t.date),
  }),
)

export const alerts = pgTable('alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  portfolioId: uuid('portfolio_id')
    .notNull()
    .references(() => portfolios.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  type: text('type').notNull(),
  config: jsonb('config').notNull(),
  lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true, mode: 'string' }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
})

export const widgetInstances = pgTable('widget_instances', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  type: text('type').notNull(),
  config: jsonb('config').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
})

export const dashboardLayouts = pgTable('dashboard_layouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  widgetInstanceId: uuid('widget_instance_id')
    .notNull()
    .references(() => widgetInstances.id, { onDelete: 'cascade' }),
  x: integer('x').notNull(),
  y: integer('y').notNull(),
  w: integer('w').notNull(),
  h: integer('h').notNull(),
  breakpoint: text('breakpoint').notNull().default('lg'),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
})
