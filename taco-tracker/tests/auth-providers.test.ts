import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuthProviders } from '../lib/auth/providers'

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co/')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-test-key')
})

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('OAuth provider availability', () => {
  it('uses the public key and never caches enabled-provider settings', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ external: { google: true, kakao: false } }) })
    vi.stubGlobal('fetch', fetchMock)
    expect(await getAuthProviders()).toEqual({ google: true, kakao: false })
    expect(fetchMock).toHaveBeenCalledWith('https://project.supabase.co/auth/v1/settings', expect.objectContaining({ headers: { apikey: 'public-test-key' }, cache: 'no-store' }))
  })
  it('does not enable providers when the Auth response has unexpected values', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ external: { google: 'false' } }) }))
    expect(await getAuthProviders()).toEqual({ google: false, kakao: false })
  })
  it('returns unavailable for service failures rather than guessing provider status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')))
    expect(await getAuthProviders()).toBeNull()
  })
  it('does not call the network without public Supabase configuration', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await getAuthProviders()).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
