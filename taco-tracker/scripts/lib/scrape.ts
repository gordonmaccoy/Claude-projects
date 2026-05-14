import { inferDishTags, inferDietaryFlags } from './enrich'

export interface RawImage {
  src: string
  width: number
  height: number
  inGallery: boolean
}

export interface ScrapedPage {
  images: RawImage[]
  menuText: string
  categoryText: string
}

export type EnrichmentConfidence = 'high' | 'medium' | 'low'

export interface ScrapeResult {
  cover_photo_url: string | null
  photo_candidates: string[]
  dish_tags: string[]
  has_vegan_options: boolean | null
  has_vegetarian_options: boolean | null
  is_halal: boolean | null
  enrichment_confidence: EnrichmentConfidence
  needs_review: boolean
  review_reason: string | null
}

export const MIN_IMAGE_DIMENSION = 200
export const MAX_CANDIDATES = 8

export const ALLOWED_HOSTS: readonly string[] = [
  't1.daumcdn.net',
  'img1.daumcdn.net',
  'img2.daumcdn.net',
  'k.kakaocdn.net',
  'mk.kakaocdn.net',
]

export const REJECT_URL_PATTERNS: readonly RegExp[] = [
  /\/icon[_-]/i,
  /\/sprite/i,
  /\/logo/i,
  /\/btn[_-]/i,
  /\.svg(\?|$)/i,
]

/**
 * True when the image looks like a real restaurant photo (vs UI chrome).
 * Defensive: a malformed URL returns false rather than throwing.
 */
export function isLikelyRestaurantPhoto(img: RawImage): boolean {
  let host: string
  try {
    host = new URL(img.src).hostname
  } catch {
    return false
  }
  if (!ALLOWED_HOSTS.includes(host)) return false
  if (img.width < MIN_IMAGE_DIMENSION || img.height < MIN_IMAGE_DIMENSION) return false
  if (REJECT_URL_PATTERNS.some((re) => re.test(img.src))) return false
  return true
}

/**
 * Strip query string so the same image at different sizes collapses to one entry.
 */
function stripQuery(url: string): string {
  const i = url.indexOf('?')
  return i === -1 ? url : url.slice(0, i)
}

/**
 * Dedupe by stripped URL, sort gallery-first then largest-first, cap at MAX_CANDIDATES.
 * Note: this does NOT pre-filter through isLikelyRestaurantPhoto; the caller is
 * expected to do that so the dedup happens on the already-validated set.
 */
export function pickPhotoCandidates(images: RawImage[]): string[] {
  const seen = new Map<string, RawImage>()
  for (const img of images) {
    const key = stripQuery(img.src)
    const existing = seen.get(key)
    // Keep the highest-resolution variant of the same image
    if (!existing || img.width * img.height > existing.width * existing.height) {
      seen.set(key, { ...img, src: key })
    }
  }
  const sorted = Array.from(seen.values()).sort((a, b) => {
    if (a.inGallery !== b.inGallery) return a.inGallery ? -1 : 1
    return b.width * b.height - a.width * a.height
  })
  return sorted.slice(0, MAX_CANDIDATES).map((i) => i.src)
}

/**
 * Cover photo is just the first candidate (gallery + largest by sort order).
 */
export function pickCoverPhoto(candidates: string[]): string | null {
  return candidates[0] ?? null
}

/**
 * Confidence rules (see plan):
 *   - hasMenuText=false -> forced low (we extracted nothing useful)
 *   - photo + dish tag    -> high
 *   - one of the two      -> medium with a specific reason
 *   - neither             -> low
 */
export function scoreConfidence(args: {
  hasPhoto: boolean
  dishTagCount: number
  hasMenuText: boolean
}): { confidence: EnrichmentConfidence; needsReview: boolean; reason: string | null } {
  if (!args.hasMenuText) {
    return {
      confidence: 'low',
      needsReview: true,
      reason: 'no menu or category text found in DOM',
    }
  }
  const hasTag = args.dishTagCount > 0
  if (args.hasPhoto && hasTag) {
    return { confidence: 'high', needsReview: false, reason: null }
  }
  if (args.hasPhoto && !hasTag) {
    return {
      confidence: 'medium',
      needsReview: true,
      reason: 'no menu text matched a dish keyword',
    }
  }
  if (!args.hasPhoto && hasTag) {
    return {
      confidence: 'medium',
      needsReview: true,
      reason: 'no images > 200px from Kakao CDN',
    }
  }
  return {
    confidence: 'low',
    needsReview: true,
    reason: 'no photo candidates and no dish tag matches',
  }
}

/**
 * Orchestrates filtering, photo selection, dish/dietary detection, and scoring
 * into the final write payload. Pure: no I/O.
 */
export function buildScrapeResult(page: ScrapedPage): ScrapeResult {
  const validImages = page.images.filter(isLikelyRestaurantPhoto)
  const candidates = pickPhotoCandidates(validImages)
  const cover = pickCoverPhoto(candidates)

  const haystack = `${page.menuText} ${page.categoryText}`.trim()
  const dishTags = inferDishTags(haystack)
  const dietary = inferDietaryFlags(haystack)

  const hasMenuText = page.menuText.trim().length > 0 || page.categoryText.trim().length > 0
  const score = scoreConfidence({
    hasPhoto: cover !== null,
    dishTagCount: dishTags.length,
    hasMenuText,
  })

  return {
    cover_photo_url: cover,
    photo_candidates: candidates,
    dish_tags: dishTags,
    has_vegan_options: dietary.has_vegan_options,
    has_vegetarian_options: dietary.has_vegetarian_options,
    is_halal: dietary.is_halal,
    enrichment_confidence: score.confidence,
    needs_review: score.needsReview,
    review_reason: score.reason,
  }
}
