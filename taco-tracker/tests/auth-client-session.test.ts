import { describe, expect, it, vi } from 'vitest'
import type { AuthChangeEvent, Session, SupabaseClient, User } from '@supabase/supabase-js'
import { watchBrowserSession, signOutBrowser } from '../lib/auth/client-session'

function createAuthHarness() {
  let notify: (event: AuthChangeEvent, session: Session | null) => void = () => {}
  let resolveLookup!: (value: { data: { user: User | null }; error: null }) => void
  const lookup = new Promise<{ data: { user: User | null }; error: null }>((resolve) => { resolveLookup = resolve })
  const unsubscribe = vi.fn()
  const signOut = vi.fn().mockResolvedValue({ error: null })
  const client = { auth: {
    onAuthStateChange: (listener: typeof notify) => { notify = listener; return { data: { subscription: { unsubscribe } } } },
    getUser: () => lookup,
    signOut,
  } } as unknown as SupabaseClient
  return { client, unsubscribe, signOut, resolveLookup, emit: (event: AuthChangeEvent, session: Session | null) => notify(event, session) }
}

const emailLessUser = { id: 'kakao-user', email: undefined } as User
const session = { user: emailLessUser } as Session

describe('private header session state', () => {
  it('updates the UI with a boolean for an email-less Kakao account', async () => {
    const harness = createAuthHarness()
    const update = vi.fn()
    watchBrowserSession(harness.client, update)
    harness.resolveLookup({ data: { user: emailLessUser }, error: null })
    await Promise.resolve()
    expect(update).toHaveBeenCalledExactlyOnceWith(true)
  })
  it('does not let an older user lookup restore signed-in state after logout', async () => {
    const harness = createAuthHarness()
    const update = vi.fn()
    watchBrowserSession(harness.client, update)
    harness.emit('SIGNED_OUT', null)
    harness.resolveLookup({ data: { user: emailLessUser }, error: null })
    await Promise.resolve()
    expect(update).toHaveBeenCalledExactlyOnceWith(false)
  })
  it('does not let an older signed-out lookup replace a newer successful login', async () => {
    const harness = createAuthHarness()
    const update = vi.fn()
    watchBrowserSession(harness.client, update)
    harness.emit('SIGNED_IN', session)
    harness.resolveLookup({ data: { user: null }, error: null })
    await Promise.resolve()
    expect(update).toHaveBeenCalledExactlyOnceWith(true)
  })
  it('ignores delayed initial-session events after logout', () => {
    const harness = createAuthHarness()
    const update = vi.fn()
    watchBrowserSession(harness.client, update)
    harness.emit('SIGNED_OUT', null)
    harness.emit('INITIAL_SESSION', session)
    expect(update).toHaveBeenCalledExactlyOnceWith(false)
  })
  it('unsubscribes and prevents updates after the header unmounts', async () => {
    const harness = createAuthHarness()
    const update = vi.fn()
    const stop = watchBrowserSession(harness.client, update)
    stop()
    harness.emit('SIGNED_IN', session)
    harness.resolveLookup({ data: { user: emailLessUser }, error: null })
    await Promise.resolve()
    expect(harness.unsubscribe).toHaveBeenCalledOnce()
    expect(update).not.toHaveBeenCalled()
  })
})

describe('browser logout', () => {
  it('signs out only this browser, keeping other devices signed in', async () => {
    const harness = createAuthHarness()
    await signOutBrowser(harness.client)
    expect(harness.signOut).toHaveBeenCalledExactlyOnceWith({ scope: 'local' })
  })
  it('rejects logout failures so the UI does not falsely claim success', async () => {
    const harness = createAuthHarness()
    const failure = new Error('Auth service unavailable')
    harness.signOut.mockResolvedValue({ error: failure })
    await expect(signOutBrowser(harness.client)).rejects.toBe(failure)
  })
})
