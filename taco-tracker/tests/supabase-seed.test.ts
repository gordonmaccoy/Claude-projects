import { describe, it, expect } from 'vitest'

describe('supabase-seed', () => {
  it('exports upsertDrafts as a function', async () => {
    const mod = await import('../scripts/lib/supabase-seed')
    expect(typeof mod.upsertDrafts).toBe('function')
  })
})
