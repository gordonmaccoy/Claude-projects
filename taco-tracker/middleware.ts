import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { type NextRequest } from 'next/server'
import { updateSession } from './lib/supabase/session'

const internationalize = createMiddleware(routing)

export default async function middleware(request: NextRequest) {
  return updateSession(request, internationalize)
}

export const config = {
  matcher: '/((?!api|auth(?:/|$)|_next|_vercel|.*\\..*).*)',
}
