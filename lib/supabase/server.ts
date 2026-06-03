import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 * Reads the session from cookies and uses the anon key (RLS applies). Use this
 * for auth (who is the user?), not for privileged data writes — those go
 * through Drizzle (lib/db).
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // setAll throws when called from a Server Component; the middleware
            // refreshes the session in that case, so this is safe to ignore.
          }
        },
      },
    },
  )
}
