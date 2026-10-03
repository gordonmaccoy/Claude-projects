import { type NextRequest, type NextResponse } from 'next/server'
import { createRouteClient } from './route'

export async function updateSession(
  request: NextRequest,
  respond: (request: NextRequest) => NextResponse
) {
  const hasAuthCookie = request.cookies.getAll().some(({ name }) => /^sb-.+-auth-token(?:\.\d+)?$/.test(name))
  if (!hasAuthCookie || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return respond(request)
  }
  const { client, finish } = createRouteClient(request)
  try {
    // Verifies the token and refreshes it if necessary. Never authorize against
    // a session decoded from an unverified request cookie.
    await client.auth.getClaims()
  } catch {
    // Auth outages must not prevent browsing the public restaurant directory.
  }
  // Construct intl's rewrite after refreshing the request Cookie header, then
  // attach updated cookies and no-cache headers to the response it returns.
  return finish(respond(request))
}
