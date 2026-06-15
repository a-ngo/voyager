/**
 * "Anonymize amounts" mode. When on, absolute monetary values are blurred so the
 * app can be shown to others without leaking net worth — relative values
 * (percentages, returns) stay visible. Applied via a `data-anon="1"` attribute
 * on <html> (set pre-paint by the inline script in app/layout.tsx) + CSS that
 * blurs `.anon-amount` and chart value axes. Persisted in localStorage.
 */
export const ANON_STORAGE_KEY = 'voyager:anon'
