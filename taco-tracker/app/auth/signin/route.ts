import { NextRequest, NextResponse } from 'next/server'
import { authErrorPath, authLocale, safeReturnPath } from '@/lib/auth/redirects'
import { getAuthProviders } from '@/lib/auth/providers'
import { createRouteClient } from '@/lib/supabase/route'

export async function POST(request: NextRequest) {
  const origin = request.nextUrl.origin
  // Browser form submissions must originate from this app.
  if (request.headers.get('origin') !== origin) {
    return new NextResponse('Invalid request origin', { status: 403, headers: { 'Cache-Control': 'no-store' } })
  }
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return new NextResponse('Invalid sign-in form', { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }
  const locale = authLocale(form.get('locale'))
  const next = safeReturnPath(form.get('next'), locale)
  const provider = form.get('provider')
  const fail = (error: string) => {
    const response = NextResponse.redirect(new URL(authErrorPath(locale, error, next), origin), 303)
    response.headers.set('Cache-Control', 'private, no-store')
    return response
  }
  if (provider !== 'google' && provider !== 'kakao') return fail('failed')
  const providers = await getAuthProviders()
  if (!providers) return fail('unavailable')
  if (!providers[provider]) return fail('notEnabled')
  try {
    const callback = new URL('/auth/callback', origin)
    callback.searchParams.set('locale', locale)
    callback.searchParams.set('next', next)
    const { client, finish } = createRouteClient(request)
    const { data, error } = await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callback.toString(), skipBrowserRedirect: true },
    })
    if (error || !data.url) return finish(fail('failed'))
    return finish(NextResponse.redirect(data.url, 303))
  } catch {
    return fail('unavailable')
  }
}
