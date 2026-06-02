'use client'

import * as React from 'react'

/**
 * App-wide client providers. TanStack Query is wired here once its provider
 * is added (kept minimal in the skeleton to avoid an unused dependency).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
