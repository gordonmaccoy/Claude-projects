import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { safeReturnPath } from '../lib/auth/redirects'

const state = vi.hoisted(() => ({
  providers: { google: true, kakao: true } as { google: boolean; kakao: boolean } | null,
  oauth: vi.fn(),
  exchange: vi.fn(),
  claims: vi.fn(),
}))

vi.mock('../lib/auth/providers', () => ({ getAuthProviders: () => Promise.resolve(state.providers) }))
vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (values: Array<{ name: string; value: string; options: object }>) => void } }) => ({
    auth: {
      signInWithOAuth: async (args: unknown) => {
        options.cookies.setAll([{ name: 'sb-project-auth-token-code-verifier', value: 'pkce-verifier', options: { path: '/', sameSite: 'lax', secure: true } }])
        return state.oauth(args)
      },
      exchangeCodeForSession: async (code: string) => {
        const result = await state.exchange(code)
        if (!result.error) options.cookies.setAll([{ name: 'sb-project-auth-token', value: 'new-session', options: { path: '/', sameSite: 'lax', secure: true } }])
        return result
      },
      getClaims: async () => {
        options.cookies.setAll([{ name: 'sb-project-auth-token', value: 'refreshed-session', options: { path: '/', sameSite: 'lax', secure: true } }])
        return state.claims()
      },
    },
  }),
}))

import { POST } from '../app/auth/signin/route'
import { GET } from '../app/auth/callback/route'
import { updateSession } from '../lib/supabase/session'

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-test-key')
  state.providers = { google: true, kakao: true }
  state.oauth.mockReset().mockResolvedValue({ data: { url: 'https://project.supabase.co/auth/v1/authorize?provider=google' }, error: null })
  state.exchange.mockReset().mockResolvedValue({ data: {}, error: null })
  state.claims.mockReset().mockResolvedValue({ data: { claims: { sub: 'test-user' } }, error: null })
})

afterEach(() => vi.unstubAllEnvs())

describe('OAuth return destination validation', () => {
  it.each([
    'https://evil.example', '//evil.example', '/\\evil.example', '/%5cevil.example',
    '/%2fevil.example', '/%0aevil.example', '/\nevil.example', '/api/private', '/auth/callback',
  ])('rejects unsafe return destination %s', (next) => {
    expect(safeReturnPath(next, 'en')).toBe('/en')
  })
  it('preserves local restaurant URLs and query strings', () => {
    expect(safeReturnPath('/en/restaurant/place-123?q=taco#photos', 'en')).toBe('/en/restaurant/place-123?q=taco#photos')
  })
  it('uses the correct Korean fallback for missing destinations', () => {
    expect(safeReturnPath(null, 'ko')).toBe('/')
  })
})

function signInRequest(provider = 'google', origin = 'https://taco.example') {
  return new NextRequest('https://taco.example/auth/signin', {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ provider, locale: 'en', next: '/en/restaurant/place-123' }),
  })
}

describe('OAuth sign-in start', () => {
  it('rejects cross-origin form submissions before creating an OAuth request', async () => {
    expect((await POST(signInRequest('google', 'https://evil.example'))).status).toBe(403)
    expect(state.oauth).not.toHaveBeenCalled()
  })
  it('rejects arbitrary provider names', async () => {
    const response = await POST(signInRequest('github'))
    expect(response.headers.get('location')).toContain('error=failed')
    expect(state.oauth).not.toHaveBeenCalled()
  })
  it('handles malformed same-origin forms without creating an OAuth request', async () => {
    const request = new NextRequest('https://taco.example/auth/signin', { method: 'POST', headers: { origin: 'https://taco.example', 'Content-Type': 'application/json' }, body: '{broken' })
    expect((await POST(request)).status).toBe(400)
    expect(state.oauth).not.toHaveBeenCalled()
  })
  it('shows a readable login error when a provider is disabled', async () => {
    state.providers = { google: false, kakao: true }
    const response = await POST(signInRequest())
    expect(response.headers.get('location')).toContain('/en/login?error=notEnabled')
    expect(state.oauth).not.toHaveBeenCalled()
  })
  it('does not send users to an unavailable Auth backend', async () => {
    state.providers = null
    expect((await POST(signInRequest())).headers.get('location')).toContain('error=unavailable')
    expect(state.oauth).not.toHaveBeenCalled()
  })
  it.each(['google', 'kakao'])('starts %s PKCE with the local callback and writes its verifier cookie', async (provider) => {
    const response = await POST(signInRequest(provider))
    const options = state.oauth.mock.calls[0][0]
    expect(options.provider).toBe(provider)
    expect(options.options.skipBrowserRedirect).toBe(true)
    const callback = new URL(options.options.redirectTo)
    expect(callback.origin).toBe('https://taco.example')
    expect(callback.pathname).toBe('/auth/callback')
    expect(callback.searchParams.get('locale')).toBe('en')
    expect(callback.searchParams.get('next')).toBe('/en/restaurant/place-123')
    expect(response.status).toBe(303)
    expect(response.cookies.get('sb-project-auth-token-code-verifier')?.value).toBe('pkce-verifier')
    expect(response.headers.get('cache-control')).toContain('no-store')
  })
})

describe('OAuth callback', () => {
  it('exchanges the code, stores session cookies and returns to the local restaurant page', async () => {
    const response = await GET(new NextRequest('https://taco.example/auth/callback?code=valid&locale=en&next=%2Fen%2Frestaurant%2Fplace-123'))
    expect(state.exchange).toHaveBeenCalledWith('valid')
    expect(response.headers.get('location')).toBe('https://taco.example/en/restaurant/place-123')
    expect(response.cookies.get('sb-project-auth-token')?.value).toBe('new-session')
    expect(response.headers.get('cache-control')).toContain('no-store')
  })
  it('never redirects an authenticated callback to another origin', async () => {
    const response = await GET(new NextRequest('https://taco.example/auth/callback?code=valid&locale=en&next=%2F%2Fevil.example'))
    expect(response.headers.get('location')).toBe('https://taco.example/en')
  })
  it('allows Kakao accounts without email and does not put user details in the redirect', async () => {
    state.exchange.mockResolvedValue({ data: { user: { id: 'kakao-user', email: null } }, error: null })
    const response = await GET(new NextRequest('https://taco.example/auth/callback?code=valid&locale=ko'))
    expect(response.headers.get('location')).toBe('https://taco.example/')
    expect(response.cookies.get('sb-project-auth-token')?.value).toBe('new-session')
  })
  it('handles missing codes without attempting an exchange', async () => {
    const response = await GET(new NextRequest('https://taco.example/auth/callback?locale=en'))
    expect(response.headers.get('location')).toContain('/en/login?error=failed')
    expect(state.exchange).not.toHaveBeenCalled()
  })
  it('handles denied consent without exposing provider error descriptions', async () => {
    const response = await GET(new NextRequest('https://taco.example/auth/callback?error=access_denied&error_description=sensitive&locale=en'))
    expect(response.headers.get('location')).toContain('error=cancelled')
    expect(response.headers.get('location')).not.toContain('sensitive')
    expect(state.exchange).not.toHaveBeenCalled()
  })
  it('rejects expired or replayed codes without creating a session cookie', async () => {
    state.exchange.mockResolvedValue({ error: { message: 'Invalid code verifier' } })
    const response = await GET(new NextRequest('https://taco.example/auth/callback?code=replayed&locale=en'))
    expect(response.headers.get('location')).toContain('error=failed')
    expect(response.cookies.get('sb-project-auth-token')).toBeUndefined()
  })
})

describe('session refresh and locale response composition', () => {
  it('puts refreshed cookies in the request before the locale rewrite and in the final browser response', async () => {
    const request = new NextRequest('https://taco.example/en', { headers: { cookie: 'sb-project-auth-token=old-session' } })
    const respond = vi.fn((updated: NextRequest) => {
      expect(updated.cookies.get('sb-project-auth-token')?.value).toBe('refreshed-session')
      expect(updated.headers.get('cookie')).toContain('refreshed-session')
      const response = NextResponse.rewrite('https://taco.example/en')
      response.cookies.set('NEXT_LOCALE', 'en')
      return response
    })
    const response = await updateSession(request, respond)
    expect(state.claims).toHaveBeenCalledTimes(1)
    expect(response.headers.get('x-middleware-rewrite')).toBe('https://taco.example/en')
    expect(response.cookies.get('NEXT_LOCALE')?.value).toBe('en')
    expect(response.cookies.get('sb-project-auth-token')?.value).toBe('refreshed-session')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })
  it('keeps locale redirects and refreshed cookies together', async () => {
    const request = new NextRequest('https://taco.example/ko', { headers: { cookie: 'sb-project-auth-token.0=old-session' } })
    const response = await updateSession(request, () => NextResponse.redirect('https://taco.example/'))
    expect(response.headers.get('location')).toBe('https://taco.example/')
    expect(response.cookies.get('sb-project-auth-token')?.value).toBe('refreshed-session')
  })
  it('does not issue auth requests or prevent caching for signed-out public visitors', async () => {
    const response = await updateSession(new NextRequest('https://taco.example/en'), () => NextResponse.next())
    expect(state.claims).not.toHaveBeenCalled()
    expect(response.headers.get('cache-control')).toBeNull()
  })
  it('keeps public browsing available during an auth service failure', async () => {
    state.claims.mockRejectedValue(new Error('Network failure'))
    const request = new NextRequest('https://taco.example/en', { headers: { cookie: 'sb-project-auth-token=old-session' } })
    expect((await updateSession(request, () => NextResponse.next())).status).toBe(200)
  })
})
