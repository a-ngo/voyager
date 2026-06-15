/**
 * Portfolio cost (fund expense ratios). Pure: holdings with a per-holding TER
 * in, blended cost out. A holding's `ter` is the expense ratio fraction, 0 for
 * fee-free holdings (direct stocks, cash), or null when a fund's TER is unknown
 * (excluded from the blend, which lowers coverage).
 */

export interface CostHolding {
  name: string
  value: number
  ter: number | null
}

export interface FundCost {
  name: string
  terPct: number
  value: number
  annualCost: number
}

export interface CostResult {
  /** Blended TER as a percent of total portfolio value. */
  weightedTerPct: number
  /** Total annual fund fees in the portfolio currency. */
  annualCost: number
  /** Share of value whose cost is known (0..1); below 1 when some funds' TER is missing. */
  coverage: number
  /** Fee-bearing funds, largest annual cost first. */
  funds: FundCost[]
}

export function portfolioCost(holdings: CostHolding[]): CostResult {
  const total = holdings.reduce((sum, h) => sum + h.value, 0)
  let annualCost = 0
  let known = 0
  const funds: FundCost[] = []

  for (const h of holdings) {
    if (h.ter == null) continue // unknown fund TER: excluded, lowers coverage
    known += h.value
    if (h.ter > 0) {
      const cost = h.value * h.ter
      annualCost += cost
      funds.push({ name: h.name, terPct: h.ter * 100, value: h.value, annualCost: cost })
    }
  }
  funds.sort((a, b) => b.annualCost - a.annualCost)

  return {
    weightedTerPct: total > 0 ? (annualCost / total) * 100 : 0,
    annualCost,
    coverage: total > 0 ? known / total : 0,
    funds,
  }
}
