import { describe, it, expect } from 'vitest'
import { routing } from '../i18n/routing'

describe('i18n routing config', () => {
  it('supports ko and en locales', () => {
    expect(routing.locales).toContain('ko')
    expect(routing.locales).toContain('en')
  })

  it('defaults to Korean', () => {
    expect(routing.defaultLocale).toBe('ko')
  })
})
