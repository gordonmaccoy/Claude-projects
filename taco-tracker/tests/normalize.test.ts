import { describe, it, expect } from 'vitest'
import { normalize, generateSlug, extractNeighborhood } from '../scripts/lib/normalize'
import type { KakaoPlace } from '../scripts/lib/kakao-client'

const mockPlace: KakaoPlace = {
  id: '12345',
  place_name: '비토스 어반 타코',
  phone: '02-797-8226',
  address_name: '서울 용산구 이태원동 34-1',
  road_address_name: '서울 용산구 이태원로 205',
  x: '126.9983',
  y: '37.5348',
  place_url: 'https://place.map.kakao.com/12345',
  category_name: '음식점 > 양식 > 멕시칸',
}

describe('generateSlug', () => {
  it('produces a url-safe slug using kakao id', () => {
    expect(generateSlug(mockPlace)).toBe('place-12345')
  })
})

describe('extractNeighborhood', () => {
  it('extracts the gu from a road address', () => {
    expect(extractNeighborhood('서울 용산구 이태원로 205')).toBe('용산구')
  })

  it('extracts the gu from a jibun address', () => {
    expect(extractNeighborhood('서울 마포구 서교동 395-166')).toBe('마포구')
  })

  it('returns null when no gu is found', () => {
    expect(extractNeighborhood('')).toBeNull()
  })
})

describe('normalize', () => {
  it('maps kakao id to kakao_place_id', () => {
    expect(normalize(mockPlace).kakao_place_id).toBe('12345')
  })

  it('parses lng from x and lat from y as floats', () => {
    const result = normalize(mockPlace)
    expect(result.lat).toBe(37.5348)
    expect(result.lng).toBe(126.9983)
  })

  it('prefers road_address_name over address_name', () => {
    expect(normalize(mockPlace).address_ko).toBe('서울 용산구 이태원로 205')
  })

  it('falls back to address_name when road address is empty', () => {
    const noRoad = { ...mockPlace, road_address_name: '' }
    expect(normalize(noRoad).address_ko).toBe('서울 용산구 이태원동 34-1')
  })

  it('sets phone to null when empty string', () => {
    const noPhone = { ...mockPlace, phone: '' }
    expect(normalize(noPhone).phone).toBeNull()
  })

  it('keeps phone when present', () => {
    expect(normalize(mockPlace).phone).toBe('02-797-8226')
  })

  it('sets cuisine to mexican', () => {
    expect(normalize(mockPlace).cuisine).toBe('mexican')
  })

  it('sets source to kakao', () => {
    expect(normalize(mockPlace).source).toBe('kakao')
  })

  it('sets status to draft', () => {
    expect(normalize(mockPlace).status).toBe('draft')
  })

  it('extracts neighborhood from road address', () => {
    expect(normalize(mockPlace).neighborhood).toBe('용산구')
  })
})
