// Captures README screenshots from a synthetic demo portfolio.
//
// End to end: ensure a confirmed demo user exists (service-role admin API),
// log in through the UI, import the synthetic Trade Republic fixture, then
// screenshot each feature page. Synthetic data only — never run against a real
// account. The demo user is isolated by its own user_id (RLS), so it never
// touches other accounts' data.
//
// Usage (app must be running on $URL):
//   URL=http://localhost:3000 node scripts/capture-screenshots.mjs
import { readFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

function loadEnv(path) {
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.trim().startsWith('#')) continue
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m) process.env[m[1]] ??= m[2].trim().replace(/^["']|["']$/g, '')
  }
}
loadEnv('.env.local')

const URL = process.env.URL ?? 'http://localhost:3000'
const OUT_DIR = process.env.OUT ?? 'docs/screens'
const CSV = resolve('tests/fixtures/trade-republic-3y-portfolio.csv')

// Synthetic demo account — not a real credential. Override via env if desired.
const DEMO_EMAIL = process.env.DEMO_EMAIL ?? 'demo@voyager.dev'
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'voyager-demo-portfolio'

mkdirSync(OUT_DIR, { recursive: true })

// ── 1. Ensure a pre-confirmed demo user (signup UI would gate on email) ─────
async function ensureDemoUser() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { error } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  })
  if (error && !/already.*registered|already been registered|exists/i.test(error.message)) {
    throw new Error(`could not create demo user: ${error.message}`)
  }
  console.log(error ? '· demo user already exists' : '✓ demo user created')
}

// ── 2. Drive the app ────────────────────────────────────────────────────────
async function run() {
  await ensureDemoUser()

  const browser = await chromium.launch()
  const page = await browser.newPage({
    viewport: { width: 1680, height: 950 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  })

  // Login
  await page.goto(`${URL}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[name="email"]', DEMO_EMAIL)
  await page.fill('input[name="password"]', DEMO_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 30_000 })
  console.log('✓ logged in')

  // Import the synthetic CSV (idempotent — safe to re-run)
  await page.goto(`${URL}/import`, { waitUntil: 'networkidle' })
  await page.setInputFiles('input[type="file"]', CSV)
  await page.waitForSelector('text=Import summary', { timeout: 60_000 })
  console.log('✓ imported synthetic portfolio')

  // Give the price layer a moment to warm the cache (Yahoo + ECB FX)
  await page.goto(`${URL}/portfolio`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(6000)

  const shots = [
    { path: 'dashboard', url: '/dashboard', wait: '.react-grid-layout', full: false },
    { path: 'portfolio', url: '/portfolio', wait: 'main', full: true },
    { path: 'performance', url: '/performance', wait: 'main', full: true },
    { path: 'xray', url: '/xray', wait: 'main', full: true },
  ]

  for (const s of shots) {
    await page.goto(`${URL}${s.url}`, { waitUntil: 'networkidle' })
    await page.waitForSelector(s.wait, { timeout: 30_000 }).catch(() => {})
    await page.waitForTimeout(2500) // Recharts entry animations
    const out = `${OUT_DIR}/${s.path}.png`
    await page.screenshot({ path: out, fullPage: s.full })
    console.log(`saved ${out}`)
  }

  // Holding detail dialog — click the first holding row in the X-Ray top-20
  try {
    await page.goto(`${URL}/xray`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2500)
    const row = page.locator('[role="button"], button, tr, li').filter({ hasText: /Apple|Microsoft|Allianz|MSCI/ }).first()
    await row.click({ timeout: 8000 })
    await page.waitForSelector('[role="dialog"]', { timeout: 8000 })
    await page.waitForTimeout(1500)
    const out = `${OUT_DIR}/holding-detail.png`
    await page.screenshot({ path: out })
    console.log(`saved ${out}`)
  } catch (e) {
    console.log('· skipped holding-detail dialog:', e.message.split('\n')[0])
  }

  await browser.close()
  console.log('\n✅ done')
}

run().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
