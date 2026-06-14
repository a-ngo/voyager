/**
 * Selectable themes. Each maps to a `[data-theme]` palette in globals.css; the
 * choice persists in localStorage and is applied pre-paint by the inline script
 * in the root layout. Adding a theme = one entry here + one palette block.
 */
export interface ThemeOption {
  id: string
  label: string
  hint: string
  /** Preview swatch for the picker (base background + accent). */
  swatch: { bg: string; accent: string }
}

export const THEMES = [
  { id: 'ember', label: 'Ember', hint: 'Warm editorial', swatch: { bg: '#262624', accent: '#d2794f' } },
  { id: 'ion', label: 'Ion', hint: 'Crisp & technical', swatch: { bg: '#0d0d12', accent: '#8b5cff' } },
  { id: 'onyx', label: 'Onyx', hint: 'Monochrome minimal', swatch: { bg: '#000000', accent: '#ffffff' } },
  { id: 'halo', label: 'Halo', hint: 'Clean & refined', swatch: { bg: '#000000', accent: '#0a84ff' } },
  { id: 'coral', label: 'Coral', hint: 'Warm & friendly', swatch: { bg: '#1a1718', accent: '#ff5a76' } },
] as const satisfies ThemeOption[]

export type ThemeId = (typeof THEMES)[number]['id']

export const DEFAULT_THEME: ThemeId = 'ion'
export const THEME_STORAGE_KEY = 'voyager:theme'
export const THEME_IDS = THEMES.map((t) => t.id) as ThemeId[]
