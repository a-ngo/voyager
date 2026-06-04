/**
 * EUR foreign-exchange rates from the ECB daily reference feed (official, free,
 * keyless). Rates are EUR-based: rates[USD] = how many USD per 1 EUR.
 */

const ECB_DAILY = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'

export type EurRates = Record<string, number>

/** Returns { EUR: 1, USD: 1.164, GBP: 0.865, ... }. Degrades to { EUR: 1 } on failure. */
export async function fetchEcbEurRates(): Promise<EurRates> {
  const rates: EurRates = { EUR: 1 }
  try {
    const res = await fetch(ECB_DAILY, { next: { revalidate: 3600 } })
    if (!res.ok) return rates
    const xml = await res.text()
    const re = /currency='([A-Z]{3})'\s+rate='([\d.]+)'/g
    let m: RegExpExecArray | null
    while ((m = re.exec(xml)) !== null) {
      const [, code, rate] = m
      if (code && rate) rates[code] = Number(rate)
    }
  } catch {
    // Network/parse failure → only EUR known; non-EUR holdings stay unpriced.
  }
  return rates
}

/** Convert an amount in `currency` to EUR. Returns null when the rate is unknown. */
export function toEur(amount: number, currency: string, rates: EurRates): number | null {
  if (currency === 'EUR') return amount
  const rate = rates[currency]
  return rate ? amount / rate : null
}
