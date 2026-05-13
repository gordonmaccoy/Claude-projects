import { describe, it, expect } from 'vitest'
import { pinSvg, pinDataUri } from '../components/map/pin-icon'

describe('pinSvg', () => {
  it('default variant uses terracotta fill and mole-brown outline', () => {
    const svg = pinSvg({ active: false })
    expect(svg).toContain('fill="#C84B2F"')
    expect(svg).toContain('stroke="#3B2A1F"')
  })

  it('active variant inverts to cream fill and terracotta outline', () => {
    const svg = pinSvg({ active: true })
    expect(svg).toContain('fill="#FFFBF2"')
    expect(svg).toContain('stroke="#C84B2F"')
  })

  it('uses a 32x32 viewBox', () => {
    expect(pinSvg({ active: false })).toContain('viewBox="0 0 32 32"')
  })
})

describe('pinDataUri', () => {
  it('returns a data URI for an SVG image', () => {
    const uri = pinDataUri({ active: false })
    expect(uri.startsWith('data:image/svg+xml;utf8,')).toBe(true)
    expect(uri).toContain('%3Csvg') // url-encoded <svg
  })
})
