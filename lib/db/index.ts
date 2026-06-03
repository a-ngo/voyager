import 'server-only'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

/**
 * Server-only Drizzle client over the Supabase Postgres connection.
 *
 * This connection authenticates as the database user, so it BYPASSES RLS.
 * Every query through it must scope by user_id explicitly. RLS stays enabled
 * as defense-in-depth for the anon/client (Supabase JS) path.
 *
 * Lazy singleton: the connection is created on first use, not at import time,
 * so `next build` and dev work before DATABASE_URL is configured.
 */
type Db = ReturnType<typeof drizzle<typeof schema>>

let client: ReturnType<typeof postgres> | null = null
let db: Db | null = null

export function getDb(): Db {
  if (db) return db

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set — configure it before using the database.')
  }

  // prepare:false is required for Supabase's transaction-mode connection pooler.
  client = postgres(connectionString, { prepare: false })
  db = drizzle(client, { schema })
  return db
}

export { schema }
