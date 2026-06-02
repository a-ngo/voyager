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
  { label: 'Equity ETF', value: 58, color: '#61afef' },
  { label: 'US Stocks', value: 22, color: '#50fa7b' },
  { label: 'Crypto', value: 9, color: '#c678dd' },
  { label: 'Bonds', value: 7, color: '#f0ad4e' },
  { label: 'Cash', value: 4, color: '#828997' },
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
  { label: 'Equity ETF', current: 58, target: 60, color: '#61afef' },
  { label: 'US Stocks', current: 22, target: 15, color: '#50fa7b' },
  { label: 'Crypto', current: 9, target: 5, color: '#c678dd' },
  { label: 'Bonds', current: 7, target: 15, color: '#f0ad4e' },
  { label: 'Cash', current: 4, target: 5, color: '#828997' },
]

export const MOCK_NET_WORTH = {
  current: 83420,
  goal: 250000,
  currency: 'EUR',
  /** Net contributions over the trailing window, for a simple pace hint. */
  monthlyContribution: 1200,
}
