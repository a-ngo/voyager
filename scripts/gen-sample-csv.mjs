// Generates a realistic 3-year Trade Republic CSV export for manual import
// testing: a monthly MSCI World savings plan plus individual stock trades,
// dividends, a sell, interest, card spend, and rewards. Deterministic (seeded),
// synthetic data only — no real PII. Output: tests/fixtures/trade-republic-3y-portfolio.csv
import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'

// ── Seeded RNG so the file is reproducible ──────────────────────────────────
function mulberry32(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(42)

// ── Instruments and a 36-month price walk (Jan 2021 → Dec 2023) ─────────────
// Market-wide drag applied across 2022 (months 12–23) to mimic the bear market.
const MONTHS = 36
const instruments = {
  IWDA: { isin: 'IE00B4L5Y983', cls: 'ETF', start: 70, mean: 0.008, vol: 0.03 },
  AAPL: { isin: 'US0378331005', cls: 'STOCK', start: 130, mean: 0.012, vol: 0.06 },
  MSFT: { isin: 'US5949181045', cls: 'STOCK', start: 215, mean: 0.013, vol: 0.06 },
  ALV: { isin: 'DE0008404005', cls: 'STOCK', start: 200, mean: 0.006, vol: 0.05 },
}
const prices = {}
for (const [sym, inst] of Object.entries(instruments)) {
  const series = [inst.start]
  for (let m = 1; m < MONTHS; m++) {
    const drag = m >= 12 && m < 24 ? -0.022 : 0 // 2022 downturn
    const ret = inst.mean + drag + (rnd() - 0.5) * 2 * inst.vol
    series.push(Math.max(1, series[m - 1] * (1 + ret)))
  }
  prices[sym] = series
}
const px = (sym, m) => prices[sym][m]

// ── Row helpers ─────────────────────────────────────────────────────────────
const COLUMNS = [
  'datetime', 'date', 'account_type', 'category', 'type', 'asset_class', 'name',
  'symbol', 'shares', 'price', 'amount', 'fee', 'tax', 'currency', 'original_amount',
  'original_currency', 'fx_rate', 'description', 'transaction_id', 'counterparty_name',
  'counterparty_iban', 'payment_reference', 'mcc_code',
]
const rows = []
const iso = (y, mo, d, h = 9) =>
  `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00.000Z`
const ymd = (y, mo, d) => `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const n = (v, dp) => (v == null ? '' : Number(v).toFixed(dp))

function row(o) {
  const [y, mo] = o.month // monthIndex → year/month
  rows.push({
    datetime: iso(y, mo, o.day, o.hour ?? 9),
    date: ymd(y, mo, o.day),
    account_type: 'DEFAULT',
    category: o.category ?? 'TRADING',
    type: o.type,
    asset_class: o.cls ?? '',
    name: '',
    symbol: o.isin ?? '',
    shares: n(o.shares, 10),
    price: n(o.price, 6),
    amount: n(o.amount, 2),
    fee: n(o.fee, 2),
    tax: n(o.tax, 2),
    currency: 'EUR',
    original_amount: '',
    original_currency: '',
    fx_rate: '',
    description: o.desc ?? '',
    transaction_id: randomUUID(),
    counterparty_name: o.cpName ?? '',
    counterparty_iban: o.cpIban ?? '',
    payment_reference: o.cpRef ?? '',
    mcc_code: o.mcc ?? '',
  })
}

const monthOf = (i) => [2021 + Math.floor(i / 12), (i % 12) + 1]
const taxOf = (gross) => -Number((gross * 0.26375).toFixed(2)) // German withholding ~26.375%

// ── Opening + periodic deposits (carry synthetic PII to test stripping) ─────
const deposits = [
  [0, 5, 3000], // 2021-01
  [12, 3, 2500], // 2022-01
  [24, 3, 2500], // 2023-01
]
for (const [mi, day, amt] of deposits) {
  row({ month: monthOf(mi), day, type: 'CUSTOMER_INBOUND', category: 'CASH', amount: amt,
    desc: 'Sparen TR', cpName: 'Max Mustermann', cpIban: 'DE00100110012620080003', cpRef: 'Einzahlung' })
}

// ── Monthly MSCI World savings plan: €200 into IWDA ─────────────────────────
for (let m = 0; m < MONTHS; m++) {
  const price = px('IWDA', m)
  row({ month: monthOf(m), day: 2, type: 'SAVINGS_PLAN_EXECUTE', cls: 'ETF', isin: instruments.IWDA.isin,
    shares: 200 / price, price, amount: -200, desc: 'Sparplan IWDA' })
}

// ── Individual stock buys ───────────────────────────────────────────────────
const buys = [
  [1, 10, 'AAPL', 12], // 2021-02
  [5, 12, 'MSFT', 6], // 2021-06
  [10, 8, 'AAPL', 5], // 2021-11
  [14, 15, 'ALV', 8], // 2022-03
  [20, 9, 'MSFT', 4], // 2022-09 (buying the dip)
]
for (const [mi, day, sym, qty] of buys) {
  const price = px(sym, mi)
  row({ month: monthOf(mi), day, hour: 10, type: 'BUY', cls: 'STOCK', isin: instruments[sym].isin,
    shares: qty, price, amount: -(qty * price), fee: -1 })
}

// ── One partial sell (realized gain) ────────────────────────────────────────
{
  const mi = 32, qty = 4, price = px('AAPL', mi) // 2023-09
  row({ month: monthOf(mi), day: 14, hour: 11, type: 'SELL', cls: 'STOCK', isin: instruments.AAPL.isin,
    shares: qty, price, amount: qty * price, fee: -1, tax: -8.5 })
}

// ── Dividends (with withholding tax) ────────────────────────────────────────
const dividends = [
  [4, 12, 'AAPL', 'STOCK', 3.0], [7, 12, 'AAPL', 'STOCK', 3.2], [10, 12, 'AAPL', 'STOCK', 3.4],
  [16, 12, 'AAPL', 'STOCK', 4.6], [28, 12, 'AAPL', 'STOCK', 5.0],
  [8, 14, 'MSFT', 'STOCK', 3.7], [20, 14, 'MSFT', 'STOCK', 4.2], [32, 14, 'MSFT', 'STOCK', 4.5],
  [4, 9, 'ALV', 'STOCK', 0], [16, 9, 'ALV', 'STOCK', 86.4], [28, 9, 'ALV', 'STOCK', 92.0],
]
for (const [mi, day, sym, cls, gross] of dividends) {
  if (gross <= 0) continue
  row({ month: monthOf(mi), day, type: 'DIVIDEND', cls, isin: instruments[sym].isin, category: 'CASH',
    amount: gross, tax: taxOf(gross), desc: `Dividende ${sym}` })
}

// ── Interest on cash (TR started paying in 2023) ────────────────────────────
for (const [mi, amt] of [[29, 7.8], [32, 9.1], [35, 9.4]]) {
  row({ month: monthOf(mi), day: 1, type: 'INTEREST', category: 'CASH', amount: amt, desc: 'Zinsen' })
}

// ── A free-share reward and a couple of card transactions / round-ups ───────
row({ month: monthOf(2), day: 20, type: 'STOCKPERK', cls: 'STOCK', isin: instruments.AAPL.isin,
  category: 'CASH', amount: 12, desc: 'Geschenkaktie' })
row({ month: monthOf(18), day: 7, hour: 13, type: 'CARD_TRANSACTION', category: 'PAYMENT', amount: -42.9,
  desc: 'Kartenzahlung', cpName: 'REWE Markt GmbH', mcc: '5411' })
row({ month: monthOf(26), day: 18, hour: 19, type: 'CARD_TRANSACTION', category: 'PAYMENT', amount: -15.5,
  desc: 'Kartenzahlung', cpName: 'Deutsche Bahn', mcc: '4112' })
row({ month: monthOf(22), day: 11, type: 'ROUND_UP', category: 'CASH', amount: 0.62, desc: 'Round Up' })

// ── Sort chronologically and write ──────────────────────────────────────────
rows.sort((a, b) => a.datetime.localeCompare(b.datetime))

// Self-check against the schema's hard rules before writing.
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const KNOWN = new Set(['BUY','SELL','CUSTOMER_INBOUND','CUSTOMER_OUTBOUND','DIVIDEND','STOCKPERK',
  'INTEREST','SAVINGS_PLAN_EXECUTE','TAX_REFUND','ROUND_UP','CARD_TRANSACTION'])
for (const r of rows) {
  if (!uuidRe.test(r.transaction_id)) throw new Error('bad uuid')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) throw new Error('bad date ' + r.date)
  if (Number.isNaN(Date.parse(r.datetime))) throw new Error('bad datetime')
  if (r.currency.length !== 3) throw new Error('bad currency')
  if (!KNOWN.has(r.type)) throw new Error('unknown type ' + r.type)
}

const lines = [COLUMNS.join(';'), ...rows.map((r) => COLUMNS.map((c) => r[c]).join(';'))]
const out = 'tests/fixtures/trade-republic-3y-portfolio.csv'
writeFileSync(out, lines.join('\n') + '\n')

const byType = {}
for (const r of rows) byType[r.type] = (byType[r.type] ?? 0) + 1
console.log(`Wrote ${rows.length} rows to ${out}`)
console.log('By type:', byType)
