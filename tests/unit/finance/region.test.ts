import { describe, it, expect } from 'vitest'
import { regionAllocation, type Breakdown } from '@/lib/finance/xray'
import { countryContinent, countryCcn3 } from '@/lib/finance/geo'

describe('countryContinent', () => {
  it('maps countries to a 6-continent scheme, splitting the Americas', () => {
    expect(countryContinent('United States')).toBe('North America')
    expect(countryContinent('Brazil')).toBe('South America')
    expect(countryContinent('Germany')).toBe('Europe')
    expect(countryContinent('Taiwan')).toBe('Asia')
    expect(countryContinent('Australia')).toBe('Oceania')
    expect(countryContinent('South Africa')).toBe('Africa')
  })

  it('handles Yahoo name variants via aliases', () => {
    expect(countryContinent('United States of America')).toBe('North America')
    expect(countryContinent('Czech Republic')).toBe('Europe')
    expect(countryContinent('UK')).toBe('Europe')
  })

  it('returns null for unknown names', () => {
    expect(countryContinent('Atlantis')).toBeNull()
  })
})

describe('countryCcn3', () => {
  it('returns ISO numeric codes used to join the world map', () => {
    expect(countryCcn3('United States')).toBe('840')
    expect(countryCcn3('Germany')).toBe('276')
  })
})

describe('regionAllocation', () => {
  it('aggregates country slices into continents and carries coverage', () => {
    const countries: Breakdown = {
      coverage: 0.8,
      slices: [
        { label: 'United States', value: 60, weight: 60 },
        { label: 'Canada', value: 10, weight: 10 },
        { label: 'Germany', value: 20, weight: 20 },
        { label: 'Atlantis', value: 10, weight: 10 }, // unrecognized → dropped
      ],
    }
    const regions = regionAllocation(countries, 100)
    const byLabel = Object.fromEntries(regions.slices.map((s) => [s.label, s.value]))
    expect(byLabel['North America']).toBe(70)
    expect(byLabel['Europe']).toBe(20)
    expect(byLabel['Atlantis']).toBeUndefined()
    // 90 of 100 classified into a continent (Atlantis dropped).
    expect(regions.coverage).toBeCloseTo(0.9)
    // Sorted by value descending.
    expect(regions.slices[0]?.label).toBe('North America')
  })
})
