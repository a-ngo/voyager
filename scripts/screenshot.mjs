// Captures a dashboard screenshot for the README.
// Usage: node scripts/screenshot.mjs  (requires the app running on $URL)
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const URL = process.env.URL ?? 'http://localhost:3000/dashboard'
const OUT = process.env.OUT ?? 'docs/dashboard.png'

mkdirSync('docs', { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1680, height: 820 }, // desktop lg breakpoint; fits the full default grid
  deviceScaleFactor: 2, // crisp on retina / for README
  colorScheme: 'dark',
})

await page.goto(URL, { waitUntil: 'networkidle' })
// Let lazy widgets + Recharts entry animations settle.
await page.waitForSelector('.react-grid-layout')
await page.waitForTimeout(2000)

await page.screenshot({ path: OUT })
await browser.close()
console.log(`saved ${OUT}`)
