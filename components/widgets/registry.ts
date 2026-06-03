import { lazy } from 'react'
import { z } from 'zod'
import type { ComponentType } from 'react'

export type WidgetCategory =
  | 'performance'
  | 'allocation'
  | 'kpi'
  | 'benchmark'
  | 'alerts'
  | 'other'

export interface WidgetProps<TConfig = unknown> {
  widgetId: string
  config: TConfig
  onConfigChange: (config: TConfig) => void
  isEditMode: boolean
}

export interface WidgetDefinition<TConfig = unknown> {
  /** Unique stable identifier — never rename after creation (stored in DB). */
  type: string
  label: string
  description: string
  category: WidgetCategory
  defaultSize: { w: number; h: number }
  minSize?: { w: number; h: number }
  maxSize?: { w: number; h: number }
  /** Zod schema for this widget's config (stored in DB as JSONB). */
  configSchema: z.ZodType<TConfig>
  defaultConfig: TConfig
  component: ComponentType<WidgetProps<TConfig>>
}

// ─── REGISTRY ────────────────────────────────────────────────────────────────
// Add new widget definitions here. This is the ONLY place to register widgets.

/* eslint-disable @typescript-eslint/no-explicit-any -- heterogeneous config types
   are validated per-widget via configSchema; the registry map is intentionally
   type-erased so widgets with different TConfig can coexist in one record. */
export const WIDGET_REGISTRY: Record<string, WidgetDefinition<any>> = {
  'performance-chart': {
    type: 'performance-chart',
    label: 'Performance Chart',
    description: 'Portfolio value over time with optional benchmark overlay',
    category: 'performance',
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 3, h: 3 },
    configSchema: z.object({
      timeRange: z.enum(['1M', '3M', '6M', '1Y', '3Y', 'ALL']),
      showBenchmark: z.boolean(),
      benchmarkTicker: z.string().optional(),
    }),
    defaultConfig: { timeRange: '1Y', showBenchmark: true, benchmarkTicker: 'IWDA.AS' },
    component: lazy(() => import('./performance/PerformanceChartWidget')),
  },
  'allocation-pie': {
    type: 'allocation-pie',
    label: 'Allocation Pie',
    description: 'Current portfolio allocation breakdown',
    category: 'allocation',
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    configSchema: z.object({
      groupBy: z.enum(['asset', 'sector', 'geography', 'currency']),
    }),
    defaultConfig: { groupBy: 'asset' },
    component: lazy(() => import('./allocation/AllocationPieWidget')),
  },
  'total-return': {
    type: 'total-return',
    label: 'Total Return',
    description: 'Headline return KPI across the selected window',
    category: 'kpi',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    configSchema: z.object({
      timeRange: z.enum(['1M', '3M', '6M', '1Y', '3Y', 'ALL']),
    }),
    defaultConfig: { timeRange: 'ALL' },
    component: lazy(() => import('./kpi/TotalReturnWidget')),
  },
  'net-worth-goal': {
    type: 'net-worth-goal',
    label: 'Net Worth Goal',
    description: 'Total net worth tracked against a savings goal',
    category: 'kpi',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 3, h: 2 },
    configSchema: z.object({
      goal: z.number().positive(),
    }),
    defaultConfig: { goal: 250000 },
    component: lazy(() => import('./kpi/NetWorthGoalWidget')),
  },
  'allocation-target': {
    type: 'allocation-target',
    label: 'Target vs Current',
    description: 'Current allocation compared to target, with drift per asset',
    category: 'allocation',
    defaultSize: { w: 5, h: 4 },
    minSize: { w: 4, h: 3 },
    configSchema: z.object({
      threshold: z.number().nonnegative(),
    }),
    defaultConfig: { threshold: 5 },
    component: lazy(() => import('./allocation/AllocationTargetWidget')),
  },
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function getWidgetDefinition(type: string): WidgetDefinition | undefined {
  return WIDGET_REGISTRY[type]
}
