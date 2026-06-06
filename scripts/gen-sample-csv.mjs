// Generates a realistic 3-year Trade Republic CSV export for manual import
// testing: a monthly MSCI World savings plan plus individual stock trades,
// dividends, a sell, interest, and a reward. Matches the current export format
// (no transaction id / PII columns; instrument name included; sells signed
// negative). Deterministic (seeded), synthetic data only — no real PII.
// Output: tests/fixtures/trade-republic-3y-portfolio.csv
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
const MONTHS = 36
const instruments = {
  IWDA: { isin: 'IE00B4L5Y983', name: 'Core MSCI World', cls: 'FUND', start: 70, mean: 0.008, vol: 0.03 },
  AAPL: { isin: 'US0378331005', name: 'Apple', cls: 'STOCK', start: 130, mean: 0.012, vol: 0.06 },
  MSFT: { isin: 'US5949181045', name: 'Microsoft', cls: 'STOCK', start: 215, mean: 0.013, vol: 0.06 },
  ALV: { isin: 'DE0008404005', name: 'Allianz', cls: 'STOCK', start: 200, mean: 0.006, vol: 0.05 },
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
  'symbol', 'shares', 'price', 'amount', 'fee', 'tax', 'currency',
  'original_amount', 'original_currency', 'fx_rate',
]
const rows = []
const iso = (y, mo, d, h = 9) =>
  `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00.000Z`
const ymd = (y, mo, d) => `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const n = (v, dp) => (v == null ? '' : Number(v).toFixed(dp))

function row(o) {
  const [y, mo] = o.month
  rows.push({
    datetime: iso(y, mo, o.day, o.hour ?? 9),
    date: ymd(y, mo, o.day),
    account_type: 'DEFAULT',
    category: o.category ?? 'TRADING',
    type: o.type,
    asset_class: o.cls ?? '',
    name: o.name ?? '',
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
  })
}

const monthOf = (i) => [2021 + Math.floor(i / 12), (i % 12) + 1]
const taxOf = (gross) => -Number((gross * 0.26375).toFixed(2)) // German withholding ~26.375%

// ── Opening + periodic deposits ─────────────────────────────────────────────
for (const [mi, day, amt] of [
  [0, 5, 6000],
  [12, 3, 5000],
  [24, 3, 5000],
]) {
  row({ month: monthOf(mi), day, type: 'CUSTOMER_INBOUND', category: 'CASH', amount: amt })
}

// ── Monthly MSCI World savings plan: €200 into IWDA ─────────────────────────
for (let m = 0; m < MONTHS; m++) {
  const price = px('IWDA', m)
  row({ month: monthOf(m), day: 2, type: 'SAVINGS_PLAN_EXECUTE', cls: 'FUND', isin: instruments.IWDA.isin,
    name: instruments.IWDA.name, shares: 200 / price, price, amount: -200 })
}

// ── Individual stock buys ───────────────────────────────────────────────────
for (const [mi, day, sym, qty] of [
  [1, 10, 'AAPL', 12],
  [5, 12, 'MSFT', 6],
  [10, 8, 'AAPL', 5],
  [14, 15, 'ALV', 8],
  [20, 9, 'MSFT', 4],
]) {
  const price = px(sym, mi)
  row({ month: monthOf(mi), day, hour: 10, type: 'BUY', cls: 'STOCK', isin: instruments[sym].isin,
    name: instruments[sym].name, shares: qty, price, amount: -(qty * price), fee: -1 })
}

// ── One partial sell — shares signed negative, proceeds positive ────────────
{
  const mi = 32, qty = 4, price = px('AAPL', mi)
  row({ month: monthOf(mi), day: 14, hour: 11, type: 'SELL', cls: 'STOCK', isin: instruments.AAPL.isin,
    name: instruments.AAPL.name, shares: -qty, price, amount: qty * price, fee: -1, tax: -8.5 })
}

// ── Dividends (with withholding tax) ────────────────────────────────────────
for (const [mi, day, sym, gross] of [
  [4, 12, 'AAPL', 3.0], [7, 12, 'AAPL', 3.2], [10, 12, 'AAPL', 3.4], [16, 12, 'AAPL', 4.6], [28, 12, 'AAPL', 5.0],
  [8, 14, 'MSFT', 3.7], [20, 14, 'MSFT', 4.2], [32, 14, 'MSFT', 4.5],
  [16, 9, 'ALV', 86.4], [28, 9, 'ALV', 92.0],
]) {
  row({ month: monthOf(mi), day, type: 'DIVIDEND', cls: 'STOCK', isin: instruments[sym].isin,
    name: instruments[sym].name, category: 'CASH', amount: gross, tax: taxOf(gross) })
}

// ── Interest on cash + a free-share reward ──────────────────────────────────
for (const [mi, amt] of [[29, 7.8], [32, 9.1], [35, 9.4]]) {
  row({ month: monthOf(mi), day: 1, type: 'INTEREST_PAYMENT', category: 'CASH', amount: amt })
}
row({ month: monthOf(2), day: 20, type: 'STOCKPERK', cls: 'STOCK', isin: instruments.AAPL.isin,
  name: instruments.AAPL.name, category: 'CASH', amount: 12 })

// ── Sort chronologically, validate, write ───────────────────────────────────
rows.sort((a, b) => a.datetime.localeCompare(b.datetime))

const KNOWN = new Set([
  'BUY', 'SELL', 'CUSTOMER_INBOUND', 'SAVINGS_PLAN_EXECUTE', 'DIVIDEND', 'STOCKPERK', 'INTEREST_PAYMENT',
])
for (const r of rows) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) throw new Error('bad date ' + r.date)
  if (Number.isNaN(Date.parse(r.datetime))) throw new Error('bad datetime')
  if (!KNOWN.has(r.type)) throw new Error('unknown type ' + r.type)
}

const out = 'tests/fixtures/trade-republic-3y-portfolio.csv'
writeFileSync(out, [COLUMNS.join(';'), ...rows.map((r) => COLUMNS.map((c) => r[c]).join(';'))].join('\n') + '\n')

const byType = {}
for (const r of rows) byType[r.type] = (byType[r.type] ?? 0) + 1
// Signed cash tally (amount + fee + tax), mirroring the engine.
let cash = 0
for (const r of rows) cash += (Number(r.amount) || 0) + (Number(r.fee) || 0) + (Number(r.tax) || 0)
console.log(`Wrote ${rows.length} rows to ${out}`)
console.log('By type:', byType)
console.log(`Approx ending cash: EUR ${cash.toFixed(2)} ${cash < 0 ? '⚠️ NEGATIVE — raise deposits' : '✓'}`)
