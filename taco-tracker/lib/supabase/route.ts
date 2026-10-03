import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest, type NextResponse } from 'next/server'

// Route responses own their cookies explicitly, including PKCE verifier cookies
// on the first redirect and session cookies after the callback exchange.
export function createRouteClient(request: NextRequest) {
  const changed = new Map<string, { name: string; value: string; options: CookieOptions }>()
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          for (const cookie of cookies) {
            request.cookies.set(cookie.name, cookie.value)
            changed.set(cookie.name, cookie)
          }
        },
      },
    }
  )
  return {
    client,
    finish(response: NextResponse) {
      for (const { name, value, options } of changed.values()) response.cookies.set(name, value, options)
      response.headers.set('Cache-Control', 'private, no-store')
      response.headers.set('Pragma', 'no-cache')
      response.headers.set('Expires', '0')
      return response
    },
  }
}
