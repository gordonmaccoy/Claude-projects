import type { SupabaseClient } from '@supabase/supabase-js'

// Expose only a boolean to the header; email, provider tokens and private user
// metadata never become display props. New auth events win over an older lookup.
export function watchBrowserSession(client: SupabaseClient, update: (signedIn: boolean) => void) {
  let active = true
  let revision = 0
  const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
    if (!active || (event === 'INITIAL_SESSION' && revision > 0)) return
    if (event !== 'INITIAL_SESSION') revision += 1
    update(Boolean(session?.user))
  })
  const initialRevision = revision
  client.auth.getUser().then(({ data, error }) => {
    if (active && revision === initialRevision) update(!error && Boolean(data.user))
  }).catch(() => {
    if (active && revision === initialRevision) update(false)
  })
  return () => { active = false; subscription.unsubscribe() }
}

export async function signOutBrowser(client: SupabaseClient) {
  const { error } = await client.auth.signOut({ scope: 'local' })
  if (error) throw error
}
