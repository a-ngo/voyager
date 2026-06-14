'use client'

import { useMemo } from 'react'
import { geoEqualEarth, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Feature, Geometry } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import worldTopo from 'world-atlas/countries-110m.json'
import { countryCcn3 } from '@/lib/finance/geo'

interface Slice {
  label: string
  value: number
  weight: number
}

const WIDTH = 800
const HEIGHT = 380
const BRAND_RGB = '194, 97, 63' // --color-brand

// Build country features + projection once (module scope; this file is client-only).
const topo = worldTopo as unknown as Topology
const FEATURES = feature(topo, topo.objects.countries as GeometryCollection).features as Feature<
  Geometry,
  { name?: string }
>[]
const PATH = geoPath(
  geoEqualEarth().fitSize([WIDTH, HEIGHT], { type: 'FeatureCollection', features: FEATURES }),
)

/** Choropleth of country allocation. Joins slices to topojson features by ISO numeric code. */
export function WorldAllocationMap({ slices, coverage }: { slices: Slice[]; coverage: number }) {
  const weightByCcn3 = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of slices) {
      const ccn3 = countryCcn3(s.label)
      if (ccn3) m.set(ccn3, (m.get(ccn3) ?? 0) + s.weight)
    }
    return m
  }, [slices])
  const peak = Math.max(1, ...weightByCcn3.values())

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label="World map of country allocation"
      >
        {FEATURES.map((f) => {
          const d = PATH(f)
          if (!d) return null
          const id = f.id == null ? '' : String(f.id).padStart(3, '0')
          const weight = weightByCcn3.get(id) ?? 0
          const fill =
            weight > 0
              ? `rgba(${BRAND_RGB}, ${(0.2 + 0.8 * (weight / peak)).toFixed(3)})`
              : 'var(--color-panel-elevated)'
          return (
            <path key={id || f.properties?.name} d={d} fill={fill} stroke="var(--color-border)" strokeWidth={0.3}>
              {weight > 0 && <title>{`${f.properties?.name ?? 'Unknown'}: ${weight.toFixed(1)}%`}</title>}
            </path>
          )
        })}
      </svg>
      <p className="mt-2 text-xs text-faint">
        Darker = larger share of classified holdings
        {coverage < 0.999 ? ` · ${(coverage * 100).toFixed(0)}% classified` : ''}.
      </p>
    </div>
  )
}
