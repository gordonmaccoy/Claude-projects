export interface AuthProviders {
  google: boolean
  kakao: boolean
}

// Supabase exposes provider availability publicly; no OAuth secrets are used.
export async function getAuthProviders(): Promise<AuthProviders | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: { apikey: key },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return null
    const settings = await response.json()
    return {
      google: settings.external?.google === true,
      kakao: settings.external?.kakao === true,
    }
  } catch {
    return null
  }
}
