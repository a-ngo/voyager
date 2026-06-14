import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} })
const email = `diag+${Date.now()}@local.test`, password = 'Px!diag1234'
await admin.auth.admin.createUser({ email, password, email_confirm: true })
const b = await chromium.launch()
const c = await b.newContext()
const p = await c.newPage()
p.on('pageerror', e => console.log('PAGEERROR:', e.message, '\nSTACK:', (e.stack||'').split('\n').slice(0,4).join(' | ')))
p.on('console', m => { if (m.type()==='error') console.log('CONSOLE.ERR:', m.text().slice(0,160)) })
await p.goto('http://localhost:3000/login', { waitUntil:'domcontentloaded' })
await p.fill('input[name="email"]', email); await p.fill('input[name="password"]', password)
await Promise.all([p.waitForURL('**/dashboard',{timeout:20000}).catch(()=>{}), p.click('button[type="submit"]')])
const csv = readFileSync('tests/fixtures/trade-republic-3y-portfolio.csv')
await c.request.post('http://localhost:3000/api/import/trade-republic', { multipart:{ file:{ name:'tr.csv', mimeType:'text/csv', buffer:csv } } })
await p.waitForTimeout(8000)
// hit the API directly
const r = await c.request.get('http://localhost:3000/api/portfolio/xray')
const body = await r.text()
console.log('API /xray status=', r.status(), 'len=', body.length, 'head=', JSON.stringify(body.slice(0,120)))
// now the page
await p.goto('http://localhost:3000/xray', { waitUntil:'domcontentloaded' })
await p.waitForTimeout(12000)
console.log('xray page text head:', (await p.locator('body').innerText()).slice(0,160).replace(/\n/g,' '))
await b.close()
