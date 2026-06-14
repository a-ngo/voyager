import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} })
const email = `xr+${Date.now()}@local.test`, password = 'Px!xray12345'
await admin.auth.admin.createUser({ email, password, email_confirm: true })
const b = await chromium.launch()
const c = await b.newContext({ viewport:{width:1680,height:820}, deviceScaleFactor:2, colorScheme:'dark' })
await c.addInitScript(() => { try { localStorage.setItem('voyager:theme','ion') } catch {} })
const p = await c.newPage()
p.on('pageerror', e => console.log('PAGEERROR:', e.message))
p.on('response', r => { if (r.url().includes('/api/portfolio/xray')) console.log('  resp /xray', r.status()) })
await p.goto('http://localhost:3000/login', { waitUntil:'domcontentloaded' })
await p.fill('input[name="email"]', email); await p.fill('input[name="password"]', password)
await Promise.all([p.waitForURL('**/dashboard',{timeout:30000}).catch(()=>{}), p.click('button[type="submit"]')])
const csv = readFileSync('tests/fixtures/trade-republic-3y-portfolio.csv')
await c.request.post('http://localhost:3000/api/import/trade-republic', { multipart:{ file:{ name:'tr.csv', mimeType:'text/csv', buffer:csv } } })
const r = await c.request.get('http://localhost:3000/api/portfolio/xray', { timeout: 120000 })
console.log('warm status', r.status(), 'len', (await r.text()).length)
await p.goto('http://localhost:3000/xray', { waitUntil:'domcontentloaded' })
for (let i=0;i<18;i++) {
  await p.waitForTimeout(5000)
  const t = await p.locator('main, body').first().innerText().catch(()=>'')
  const state = t.includes('Concentration') ? 'DATA' : t.includes('Analyzing') ? 'loading' : t.includes('Couldn') ? 'ERROR' : t.includes('No priced') ? 'empty' : '???'
  console.log(`  t+${(i+1)*5}s: ${state}`)
  if (state === 'DATA' || state === 'ERROR' || state === 'empty') break
}
await p.screenshot({ path: '/tmp/xray-debug.png' })
console.log('debug shot -> /tmp/xray-debug.png')
await b.close()
