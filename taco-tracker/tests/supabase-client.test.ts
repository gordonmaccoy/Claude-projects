import { describe, it, expect } from 'vitest'

describe('Supabase client modules', () => {
  it('server module exports a createClient function', async () => {
    const mod = await import('../lib/supabase/server')
    expect(typeof mod.createClient).toBe('function')
  })

  it('browser module exports a createClient function', async () => {
    const mod = await import('../lib/supabase/client')
    expect(typeof mod.createClient).toBe('function')
  })
})
