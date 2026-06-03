import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/signup', '/auth']

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/**
 * Refreshes the Supabase session on every request and gates protected routes.
 * Unauthenticated users hitting a protected path are redirected to /login.
 *
 * If Supabase env vars are unset (fresh clone, no project yet) this is a no-op
 * passthrough so the app still runs. Auth is enforced once env is configured.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return NextResponse.next({ request })

  let response = NextResponse.next({ request })

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  // getUser() revalidates the token with Supabase — do not trust getSession() here.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // API routes enforce auth themselves and return JSON 401 — never redirect them
  // to the HTML login page (it would break the caller's fetch).
  const { pathname } = request.nextUrl
  if (!user && !isPublic(pathname) && !pathname.startsWith('/api/')) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    return NextResponse.redirect(redirectUrl)
  }

  return response
}
