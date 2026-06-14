// One-off: create a throwaway confirmed user, import the synthetic CSV for it,
// then capture README screenshots in the Ion theme. Run against the SAME
// Supabase the dev server uses:
//   node --env-file=.env.docker scripts/seed-and-shoot.mjs   # local stack
//   node --env-file=.env.local  scripts/seed-and-shoot.mjs   # cloud
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, mkdirSync } from 'node:fs'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BASE = process.env.BASE ?? 'http://localhost:3000'
if (!URL || !SERVICE_KEY) throw new Error('Missing Supabase env (run with --env-file=...)')

const email = `shots+${Date.now()}@local.test`
const password = `Px!${Math.random().toString(36).slice(2, 12)}`

const admin = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
if (error) throw new Error(`createUser failed: ${error.message}`)
console.log('created throwaway user:', email)

mkdirSync('docs/screens', { recursive: true })

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1680, height: 820 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
})
await context.addInitScript(() => {
  try {
    localStorage.setItem('voyager:theme', 'ion')
  } catch {}
})
const page = await context.newPage()

// Log in via the form (server action sets the session cookie on this context).
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.fill('input[name="email"]', email)
await page.fill('input[name="password"]', password)
await Promise.all([
  page.waitForURL('**/dashboard', { timeout: 20000 }).catch(() => {}),
  page.click('button[type="submit"]'),
])
console.log('after login, url =', page.url())

// Import the synthetic portfolio via the API (shares the browser cookies).
const csv = readFileSync('tests/fixtures/trade-republic-3y-portfolio.csv')
const res = await context.request.post(`${BASE}/api/import/trade-republic`, {
  multipart: { file: { name: 'tr.csv', mimeType: 'text/csv', buffer: csv } },
})
console.log('import:', res.status(), (await res.text()).slice(0, 200))

// Let ISIN→ticker resolution + price warming settle.
await page.waitForTimeout(10000)

const shots = [
  { url: '/dashboard', out: 'docs/screens/dashboard.png', wait: '.react-grid-layout' },
  { url: '/portfolio', out: 'docs/screens/portfolio.png', wait: 'text=Allocation' },
  { url: '/performance', out: 'docs/screens/performance.png', wait: '.recharts-surface' },
  { url: '/xray', out: 'docs/screens/xray.png', wait: 'text=Concentration' },
]
for (const s of shots) {
  await page.goto(`${BASE}${s.url}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector(s.wait, { timeout: 25000 }).catch(() => {})
  await page.waitForTimeout(3500)
  await page.screenshot({ path: s.out })
  console.log('saved', s.out)
}

// Holding detail: the page is already on /xray (last loop shot); open the
// first holding's dialog and capture it.
await page.locator('table tbody tr').first().click().catch(() => {})
await page.waitForTimeout(4500) // dialog + fundamentals fetch
await page.screenshot({ path: 'docs/screens/holding-detail.png' })
console.log('saved docs/screens/holding-detail.png')

await browser.close()
console.log('done — throwaway user left in the local DB:', email)
