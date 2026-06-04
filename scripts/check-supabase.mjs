// One-off verification: connects to the configured Supabase Postgres and checks
// that the schema + RLS are correct. Prints only structural info, never secrets.
// Run: node scripts/check-supabase.mjs
import { readFileSync } from 'node:fs'
import postgres from 'postgres'

function loadEnv(path) {
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.trim().startsWith('#')) continue
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m) process.env[m[1]] ??= m[2].trim().replace(/^["']|["']$/g, '')
  }
}
loadEnv('.env.local')

const EXPECTED = [
  'alerts',
  'dashboard_layouts',
  'isin_ticker_map',
  'portfolios',
  'price_cache',
  'transactions',
  'widget_instances',
]

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1 })
let failures = 0
const fail = (msg) => {
  failures++
  console.log('  ✗', msg)
}

try {
  const tables = await sql`
    select tablename, rowsecurity
    from pg_tables where schemaname = 'public' order by tablename`
  const policies = await sql`
    select tablename, policyname, cmd
    from pg_policies where schemaname = 'public' order by tablename, policyname`

  console.log('\n=== Tables & RLS ===')
  const found = new Map(tables.map((t) => [t.tablename, t.rowsecurity]))
  for (const name of EXPECTED) {
    if (!found.has(name)) {
      fail(`table "${name}" is MISSING (did the migration run?)`)
      continue
    }
    const rls = found.get(name)
    console.log(`  ${rls ? '✓' : '✗'} ${name.padEnd(20)} RLS ${rls ? 'enabled' : 'DISABLED'}`)
    if (!rls) fail(`RLS is DISABLED on "${name}" — table is publicly accessible`)
  }
  const extra = tables.map((t) => t.tablename).filter((n) => !EXPECTED.includes(n))
  if (extra.length) console.log('  (other tables present:', extra.join(', '), ')')

  console.log('\n=== Policies ===')
  if (policies.length === 0) fail('no RLS policies found — RLS-on with no policy denies all access')
  for (const p of policies) {
    console.log(`  • ${p.tablename.padEnd(20)} ${p.policyname}  [${p.cmd}]`)
  }

  console.log('\n=== Anon REST API (RLS smoke test) ===')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const res = await fetch(`${url}/rest/v1/transactions?select=id&limit=1`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  })
  const body = await res.json()
  if (res.status === 200 && Array.isArray(body)) {
    console.log(`  ✓ anon read reachable, returned ${body.length} rows (expected 0 — RLS hides others' data)`)
    if (body.length > 0) fail('anon could read transaction rows — RLS is NOT protecting data')
  } else {
    console.log(`  · anon read returned status ${res.status}:`, JSON.stringify(body).slice(0, 120))
  }

  console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failures} PROBLEM(S) FOUND`}`)
} catch (err) {
  console.error('\n❌ Could not complete checks:', err.message)
  failures++
} finally {
  await sql.end({ timeout: 5 })
}

process.exit(failures === 0 ? 0 : 1)
