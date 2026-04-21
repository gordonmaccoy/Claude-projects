import { describe, it, expect } from 'vitest'
import { parseKakaoResponse } from '../scripts/lib/kakao-client'

describe('parseKakaoResponse', () => {
  const mockResponse = {
    documents: [
      {
        id: '12345',
        place_name: '비토스 어반 타코',
        phone: '02-797-8226',
        address_name: '서울 용산구 이태원동 34-1',
        road_address_name: '서울 용산구 이태원로 205',
        x: '126.9983',
        y: '37.5348',
        place_url: 'https://place.map.kakao.com/12345',
        category_name: '음식점 > 양식 > 멕시칸',
      },
    ],
    meta: {
      total_count: 1,
      pageable_count: 1,
      is_end: true,
    },
  }

  it('extracts places from documents array', () => {
    const { places } = parseKakaoResponse(mockResponse)
    expect(places).toHaveLength(1)
    expect(places[0].id).toBe('12345')
  })

  it('reads isEnd from meta', () => {
    const { isEnd } = parseKakaoResponse(mockResponse)
    expect(isEnd).toBe(true)
  })

  it('returns isEnd false when there are more pages', () => {
    const { isEnd } = parseKakaoResponse({
      ...mockResponse,
      meta: { ...mockResponse.meta, is_end: false },
    })
    expect(isEnd).toBe(false)
  })

  it('returns empty places when documents is empty', () => {
    const { places } = parseKakaoResponse({
      documents: [],
      meta: { total_count: 0, pageable_count: 0, is_end: true },
    })
    expect(places).toHaveLength(0)
  })
})
