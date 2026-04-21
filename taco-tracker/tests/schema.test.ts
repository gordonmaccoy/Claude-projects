import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'

const sql = readFileSync(
  'supabase/migrations/20260421000000_initial_schema.sql',
  'utf8'
)

describe('initial schema migration', () => {
  it('defines restaurant_status enum', () => {
    expect(sql).toContain("CREATE TYPE restaurant_status AS ENUM")
  })

  it('defines restaurant_style enum', () => {
    expect(sql).toContain("CREATE TYPE restaurant_style AS ENUM")
  })

  it('creates the restaurants table', () => {
    expect(sql).toContain('CREATE TABLE restaurants')
  })

  it('creates the submissions table', () => {
    expect(sql).toContain('CREATE TABLE submissions')
  })

  it('includes bilingual alt text columns', () => {
    expect(sql).toContain('cover_photo_alt_ko')
    expect(sql).toContain('cover_photo_alt_en')
  })

  it('includes IP hash for rate limiting', () => {
    expect(sql).toContain('submitter_ip_hash')
  })
})

const rls = readFileSync(
  'supabase/migrations/20260421000001_rls_policies.sql',
  'utf8'
)

describe('RLS policies migration', () => {
  it('enables RLS on restaurants', () => {
    expect(rls).toContain('ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY')
  })

  it('enables RLS on submissions', () => {
    expect(rls).toContain('ALTER TABLE submissions ENABLE ROW LEVEL SECURITY')
  })

  it('restricts public reads to live rows', () => {
    expect(rls).toContain("status = 'live'")
  })

  it('allows public inserts on submissions', () => {
    expect(rls).toContain('FOR INSERT')
  })
})
