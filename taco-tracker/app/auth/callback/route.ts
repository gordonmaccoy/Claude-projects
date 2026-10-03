import { NextRequest, NextResponse } from 'next/server'
import { authErrorPath, authLocale, safeReturnPath } from '@/lib/auth/redirects'
import { createRouteClient } from '@/lib/supabase/route'

export async function GET(request: NextRequest) {
  const locale = authLocale(request.nextUrl.searchParams.get('locale'))
  const next = safeReturnPath(request.nextUrl.searchParams.get('next'), locale)
  const origin = request.nextUrl.origin
  const providerError = request.nextUrl.searchParams.get('error')
  const fail = (error: string) => {
    const response = NextResponse.redirect(new URL(authErrorPath(locale, error, next), origin))
    response.headers.set('Cache-Control', 'private, no-store')
    return response
  }
  if (providerError) return fail(providerError === 'access_denied' ? 'cancelled' : 'failed')
  const code = request.nextUrl.searchParams.get('code')
  if (!code) return fail('failed')
  try {
    const { client, finish } = createRouteClient(request)
    const { error } = await client.auth.exchangeCodeForSession(code)
    if (error) return finish(fail('failed'))
    return finish(NextResponse.redirect(new URL(next, origin)))
  } catch {
    return fail('unavailable')
  }
}
