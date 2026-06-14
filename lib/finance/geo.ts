import countries from 'world-countries'

/**
 * Country-name → continent + ISO numeric code, built from world-countries.
 * Used for the X-Ray region breakdown and the world map (which joins on the
 * topojson feature id = ISO numeric / `ccn3`). Country labels come from Yahoo's
 * `assetProfile.country` (full English names); ALIASES patch the few that differ.
 */

interface GeoEntry {
  ccn3: string
  continent: string
}

/** world-countries `region`/`subregion` → a 6-continent scheme (Americas split). */
function toContinent(region: string, subregion: string): string {
  switch (region) {
    case 'Europe':
      return 'Europe'
    case 'Asia':
      return 'Asia'
    case 'Africa':
      return 'Africa'
    case 'Oceania':
      return 'Oceania'
    case 'Americas':
      return subregion === 'South America' ? 'South America' : 'North America'
    default:
      return 'Other'
  }
}

const BY_NAME = new Map<string, GeoEntry>()
for (const c of countries) {
  const entry: GeoEntry = { ccn3: c.ccn3, continent: toContinent(c.region, c.subregion) }
  BY_NAME.set(c.name.common.toLowerCase(), entry)
  BY_NAME.set(c.name.official.toLowerCase(), entry)
}

/** Yahoo country name → world-countries common name, for the cases that differ. */
const ALIASES: Record<string, string> = {
  usa: 'united states',
  'united states of america': 'united states',
  uk: 'united kingdom',
  'great britain': 'united kingdom',
  'czech republic': 'czechia',
  'south korea': 'south korea',
  'north korea': 'north korea',
  russia: 'russia',
  türkiye: 'turkey',
  'hong kong sar china': 'hong kong',
}

function lookup(name: string): GeoEntry | undefined {
  const key = name.trim().toLowerCase()
  return BY_NAME.get(ALIASES[key] ?? key)
}

/** Continent for a country name, or null if unrecognized. */
export function countryContinent(name: string): string | null {
  return lookup(name)?.continent ?? null
}

/** ISO numeric code (matches world-atlas topojson feature ids), or null. */
export function countryCcn3(name: string): string | null {
  return lookup(name)?.ccn3 ?? null
}
