import { defineConfig } from 'drizzle-kit'

/**
 * drizzle-kit config for introspection and generating SQL diffs against the
 * Supabase database. The migration in supabase/migrations/ remains the source
 * of truth that runs in Postgres; lib/db/schema.ts is the typed mirror.
 */
export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './supabase/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
})
