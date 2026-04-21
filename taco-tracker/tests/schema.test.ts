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
