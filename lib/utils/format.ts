/** Display formatters. Locale fixed to en-US for consistent grouping/decimals. */

export function formatMoney(value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value)
}

export function formatQuantity(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(value)
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(iso))
}
