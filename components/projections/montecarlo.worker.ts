/// Web Worker: runs the Monte Carlo simulation off the main thread (§10).
import { simulateMonteCarlo, type MonteCarloInput } from '@/lib/finance/montecarlo'

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<MonteCarloInput>) => void) | null
  postMessage: (message: unknown) => void
}

ctx.onmessage = (e) => {
  ctx.postMessage(simulateMonteCarlo(e.data))
}
