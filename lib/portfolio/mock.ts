/**
 * Placeholder portfolio data for the skeleton UI. Replace with real
 * Supabase-backed queries (reconstructed from the transaction ledger) once
 * the data layer lands. Kept out of components so widgets stay presentational.
 */

export interface AllocationSlice {
  label: string
  value: number
  color: string
}

export const MOCK_ALLOCATION: AllocationSlice[] = [
  { label: 'Equity ETF', value: 58, color: '#6f94a6' },
  { label: 'US Stocks', value: 22, color: '#c2613f' },
  { label: 'Crypto', value: 9, color: '#9479b0' },
  { label: 'Bonds', value: 7, color: '#d2a052' },
  { label: 'Cash', value: 4, color: '#a79e8e' },
]

export interface PerformancePoint {
  date: string
  portfolio: number
  benchmark: number
}

export const MOCK_PERFORMANCE: PerformancePoint[] = [
  { date: 'Jan', portfolio: 100, benchmark: 100 },
  { date: 'Feb', portfolio: 103.2, benchmark: 101.8 },
  { date: 'Mar', portfolio: 101.5, benchmark: 100.4 },
  { date: 'Apr', portfolio: 108.1, benchmark: 104.2 },
  { date: 'May', portfolio: 112.6, benchmark: 106.9 },
  { date: 'Jun', portfolio: 110.4, benchmark: 105.1 },
  { date: 'Jul', portfolio: 117.8, benchmark: 109.7 },
  { date: 'Aug', portfolio: 121.3, benchmark: 111.2 },
]

export const MOCK_TOTAL_RETURN = {
  pct: 21.3,
  absolute: 4260,
  currency: 'EUR',
}

export interface AllocationTarget {
  label: string
  current: number // current weight, %
  target: number // target weight, %
  color: string
}

export const MOCK_ALLOCATION_TARGET: AllocationTarget[] = [
  { label: 'Equity ETF', current: 58, target: 60, color: '#6f94a6' },
  { label: 'US Stocks', current: 22, target: 15, color: '#c2613f' },
  { label: 'Crypto', current: 9, target: 5, color: '#9479b0' },
  { label: 'Bonds', current: 7, target: 15, color: '#d2a052' },
  { label: 'Cash', current: 4, target: 5, color: '#a79e8e' },
]

export const MOCK_NET_WORTH = {
  current: 83420,
  goal: 250000,
  currency: 'EUR',
  /** Net contributions over the trailing window, for a simple pace hint. */
  monthlyContribution: 1200,
}
