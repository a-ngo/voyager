// Captures README screenshots in the Ion theme.
// Requires the app running on $URL with a logged-in session.
//
//   node scripts/screenshot.mjs                                  # dashboard
//   URL=http://localhost:3000/xray OUT=docs/screens/xray.png WAIT='text=Concentration' \
//     node scripts/screenshot.mjs
//
// THEME defaults to ion; the layout reads `voyager:theme` from localStorage
// before paint, so we set it in an init script before the page loads.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const URL = process.env.URL ?? 'http://localhost:3000/dashboard'
const OUT = process.env.OUT ?? 'docs/screens/dashboard.png'
const WAIT = process.env.WAIT ?? '.react-grid-layout'
const THEME = process.env.THEME ?? 'ion'

mkdirSync('docs/screens', { recursive: true })

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1680, height: 820 }, // desktop lg breakpoint; fits the full default grid
  deviceScaleFactor: 2, // crisp on retina / for README
  colorScheme: 'dark',
})
await context.addInitScript((theme) => {
  try {
    localStorage.setItem('voyager:theme', theme)
  } catch {}
}, THEME)

const page = await context.newPage()
await page.goto(URL, { waitUntil: 'networkidle' })
// Let lazy widgets + Recharts/animations settle (selector is page-specific, so soft-fail).
if (WAIT) await page.waitForSelector(WAIT, { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(2000)

await page.screenshot({ path: OUT })
await browser.close()
console.log(`saved ${OUT} (${THEME} theme)`)
