import { describe, it, expect } from 'vitest'
import {
  isLikelyRestaurantPhoto,
  pickPhotoCandidates,
  pickCoverPhoto,
  scoreConfidence,
  buildScrapeResult,
  MAX_CANDIDATES,
  type RawImage,
} from '../scripts/lib/scrape'

const validImage = (overrides: Partial<RawImage> = {}): RawImage => ({
  src: 'https://t1.daumcdn.net/photo/abc.jpg',
  width: 400,
  height: 300,
  inGallery: true,
  ...overrides,
})

describe('isLikelyRestaurantPhoto', () => {
  it('accepts a 400x300 jpg from t1.daumcdn.net', () => {
    expect(isLikelyRestaurantPhoto(validImage())).toBe(true)
  })

  it('rejects an image smaller than 200px', () => {
    expect(isLikelyRestaurantPhoto(validImage({ width: 50, height: 50 }))).toBe(false)
  })

  it('rejects an image from a non-allowed host', () => {
    expect(
      isLikelyRestaurantPhoto(validImage({ src: 'https://googletagmanager.com/img.png' }))
    ).toBe(false)
  })

  it('rejects URLs containing /icon_close', () => {
    expect(
      isLikelyRestaurantPhoto(validImage({ src: 'https://t1.daumcdn.net/icon_close.png' }))
    ).toBe(false)
  })

  it('rejects .svg URLs', () => {
    expect(
      isLikelyRestaurantPhoto(validImage({ src: 'https://t1.daumcdn.net/photo/foo.svg' }))
    ).toBe(false)
  })

  it('rejects malformed URLs without throwing', () => {
    expect(isLikelyRestaurantPhoto(validImage({ src: 'not a url' }))).toBe(false)
  })
})

describe('pickPhotoCandidates', () => {
  it('dedupes the same URL with different size query params', () => {
    const imgs: RawImage[] = [
      validImage({ src: 'https://t1.daumcdn.net/photo/abc.jpg?w=400&h=300' }),
      validImage({ src: 'https://t1.daumcdn.net/photo/abc.jpg?w=200&h=150' }),
    ]
    expect(pickPhotoCandidates(imgs)).toEqual(['https://t1.daumcdn.net/photo/abc.jpg'])
  })

  it('caps at MAX_CANDIDATES', () => {
    const imgs: RawImage[] = Array.from({ length: MAX_CANDIDATES + 5 }, (_, i) =>
      validImage({ src: `https://t1.daumcdn.net/photo/${i}.jpg` })
    )
    expect(pickPhotoCandidates(imgs)).toHaveLength(MAX_CANDIDATES)
  })

  it('sorts gallery images before non-gallery images', () => {
    const imgs: RawImage[] = [
      validImage({ src: 'https://t1.daumcdn.net/photo/non-gallery.jpg', inGallery: false }),
      validImage({ src: 'https://t1.daumcdn.net/photo/gallery.jpg', inGallery: true }),
    ]
    expect(pickPhotoCandidates(imgs)[0]).toBe('https://t1.daumcdn.net/photo/gallery.jpg')
  })

  it('within the same gallery group, sorts larger images first', () => {
    const imgs: RawImage[] = [
      validImage({ src: 'https://t1.daumcdn.net/photo/small.jpg', width: 200, height: 200 }),
      validImage({ src: 'https://t1.daumcdn.net/photo/big.jpg', width: 800, height: 600 }),
    ]
    expect(pickPhotoCandidates(imgs)[0]).toBe('https://t1.daumcdn.net/photo/big.jpg')
  })
})

describe('pickCoverPhoto', () => {
  it('returns the first candidate', () => {
    expect(pickCoverPhoto(['a.jpg', 'b.jpg'])).toBe('a.jpg')
  })

  it('returns null for an empty list', () => {
    expect(pickCoverPhoto([])).toBeNull()
  })
})

describe('scoreConfidence', () => {
  it('returns high when both photo and dish tag exist', () => {
    expect(scoreConfidence({ hasPhoto: true, dishTagCount: 1, hasMenuText: true })).toEqual({
      confidence: 'high',
      needsReview: false,
      reason: null,
    })
  })

  it('returns medium with dish-keyword reason when only photo exists', () => {
    const r = scoreConfidence({ hasPhoto: true, dishTagCount: 0, hasMenuText: true })
    expect(r.confidence).toBe('medium')
    expect(r.needsReview).toBe(true)
    expect(r.reason).toMatch(/dish keyword/i)
  })

  it('returns medium with Kakao CDN reason when only dish tag exists', () => {
    const r = scoreConfidence({ hasPhoto: false, dishTagCount: 2, hasMenuText: true })
    expect(r.confidence).toBe('medium')
    expect(r.needsReview).toBe(true)
    expect(r.reason).toMatch(/Kakao CDN/i)
  })

  it('returns low when neither photo nor dish tag', () => {
    const r = scoreConfidence({ hasPhoto: false, dishTagCount: 0, hasMenuText: true })
    expect(r.confidence).toBe('low')
    expect(r.needsReview).toBe(true)
    expect(r.reason).toMatch(/no photo/i)
  })

  it('forces low when no menu text was found, regardless of other signals', () => {
    const r = scoreConfidence({ hasPhoto: true, dishTagCount: 5, hasMenuText: false })
    expect(r.confidence).toBe('low')
    expect(r.needsReview).toBe(true)
    expect(r.reason).toMatch(/menu or category text/i)
  })
})

describe('buildScrapeResult', () => {
  it('end-to-end: extracts dish tags from menu text and picks cover photo', () => {
    const result = buildScrapeResult({
      images: [
        validImage({ src: 'https://t1.daumcdn.net/photo/hero.jpg' }),
      ],
      menuText: '시그니처 타코 메뉴',
      categoryText: '음식점 > 양식 > 멕시칸',
    })
    expect(result.dish_tags).toContain('taco')
    expect(result.cover_photo_url).toBe('https://t1.daumcdn.net/photo/hero.jpg')
    expect(result.photo_candidates).toEqual(['https://t1.daumcdn.net/photo/hero.jpg'])
    expect(result.enrichment_confidence).toBe('high')
    expect(result.needs_review).toBe(false)
    expect(result.review_reason).toBeNull()
  })

  it('detects halal from menu text and sets is_halal', () => {
    const result = buildScrapeResult({
      images: [validImage()],
      menuText: '할랄 인증 식당',
      categoryText: '',
    })
    expect(result.is_halal).toBe(true)
  })

  it('returns null dietary flags when no evidence present', () => {
    const result = buildScrapeResult({
      images: [validImage()],
      menuText: '타코 부리또',
      categoryText: '',
    })
    expect(result.is_halal).toBeNull()
    expect(result.has_vegan_options).toBeNull()
    expect(result.has_vegetarian_options).toBeNull()
  })

  it('produces low confidence when menu and category are both empty', () => {
    const result = buildScrapeResult({
      images: [validImage()],
      menuText: '',
      categoryText: '',
    })
    expect(result.enrichment_confidence).toBe('low')
    expect(result.needs_review).toBe(true)
  })
})
