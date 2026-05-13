import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Returns a Supabase client authenticated with the service role key.
 *
 * Service role bypasses Row Level Security. ONLY use this in server-side code
 * for routes that the public should not access (e.g. /curate). Never expose
 * the resulting client or the key to the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
