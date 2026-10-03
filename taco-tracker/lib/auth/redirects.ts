export type AuthLocale = 'en' | 'ko'

export function authLocale(value: unknown): AuthLocale {
  return value === 'en' ? 'en' : 'ko'
}

export function loginPath(locale: AuthLocale) {
  return locale === 'en' ? '/en/login' : '/login'
}

// The return address stays on this app. Reject URL parser ambiguities before
// parsing, including escaped separators and controls used in redirect attacks.
export function safeReturnPath(value: unknown, locale: AuthLocale): string {
  const fallback = locale === 'en' ? '/en' : '/'
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback
  if (/[\\\u0000-\u0020\u007f]/.test(value) || /%(?:0[0-9a-f]|1[0-9a-f]|20|2f|5c|7f)/i.test(value)) return fallback
  try {
    const url = new URL(value, 'https://taco-map.invalid')
    if (url.origin !== 'https://taco-map.invalid') return fallback
    if (/^\/(?:auth|api)(?:\/|$)/.test(url.pathname)) return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}

export function authErrorPath(locale: AuthLocale, error: string, next: string) {
  const query = new URLSearchParams({ error, next: safeReturnPath(next, locale) })
  return `${loginPath(locale)}?${query}`
}
