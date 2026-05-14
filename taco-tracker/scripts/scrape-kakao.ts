/**
 * Playwright-based Kakao Maps scraper.
 *
 * Visits each restaurant's Kakao Place page, extracts photo candidates and
 * menu/category text, runs the text through the existing keyword-based
 * enrichment helpers, scores confidence, and writes a partial patch back
 * to Supabase. Rows with low or medium confidence are flagged via
 * `needs_review = true` so the curator can fix them in Supabase Studio
 * (filter the table editor by `needs_review = true`).
 *
 * USAGE
 *   pnpm scrape                          # scrape all rows where last_verified_at IS NULL
 *   pnpm scrape -- --dry-run             # extract + log payload, no DB write
 *   pnpm scrape -- --force               # re-scrape rows already verified
 *   pnpm scrape -- --id <uuid>           # one row only
 *   pnpm scrape -- --limit 5             # cap rows processed
 *   pnpm scrape -- --concurrency 2       # max simultaneous pages (default 1)
 *   pnpm scrape -- --headed              # show the browser, bumps timeout to 120s
 *   pnpm scrape -- --delay-ms 5000       # politeness delay between sequential visits
 *
 * REVIEW WORKFLOW
 *   After a run, in Supabase Studio open Table Editor → restaurants,
 *   filter by `needs_review = true`, read `review_reason`, fix manually,
 *   then set `needs_review = false`.
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { chromium, type Page } from 'playwright'
import { createAdminClient } from '../lib/supabase/admin'
import { buildScrapeResult, type RawImage, type ScrapedPage } from './lib/scrape'

// ---------------------------------------------------------------------------
// CLI flag parsing (no new deps; mirrors scripts/enrich-restaurants.ts style)
// ---------------------------------------------------------------------------

function flagValue(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 ? process.argv[i + 1] : undefined
}
function flagInt(name: string, fallback: number): number {
  const v = flagValue(name)
  if (v === undefined) return fallback
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid value for --${name}: ${v}`)
  }
  return n
}

const DRY_RUN = process.argv.includes('--dry-run')
const FORCE = process.argv.includes('--force')
const HEADED = process.argv.includes('--headed')
const ID = flagValue('id') ?? null
const LIMIT = flagValue('limit') ? flagInt('limit', 0) : null
const CONCURRENCY = Math.max(1, flagInt('concurrency', 1))
const DELAY_MS = flagInt('delay-ms', 2500)
const PAGE_TIMEOUT_MS = HEADED ? 120_000 : 30_000

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RowToScrape {
  id: string
  kakao_place_id: string
  name_ko: string
  last_verified_at: string | null
}

interface RunStats {
  ok: number
  failed: number
  byConfidence: Record<'high' | 'medium' | 'low', number>
  needsReview: number
}

// ---------------------------------------------------------------------------
// Supabase: fetch rows
// ---------------------------------------------------------------------------

async function fetchRows(
  supabase: ReturnType<typeof createAdminClient>
): Promise<RowToScrape[]> {
  let q = supabase
    .from('restaurants')
    .select('id, kakao_place_id, name_ko, last_verified_at')
    .not('kakao_place_id', 'is', null)

  if (ID) q = q.eq('id', ID)
  else if (!FORCE) q = q.is('last_verified_at', null)

  if (LIMIT && !ID) q = q.limit(LIMIT)

  const { data, error } = await q.returns<RowToScrape[]>()
  if (error) throw new Error(`Failed to fetch rows: ${error.message}`)
  return data ?? []
}

// ---------------------------------------------------------------------------
// Playwright: extract DOM content
// ---------------------------------------------------------------------------

async function scrapeOne(page: Page, kakaoPlaceId: string): Promise<ScrapedPage> {
  const url = `https://place.map.kakao.com/${kakaoPlaceId}`
  await page.goto(url, { waitUntil: 'networkidle', timeout: PAGE_TIMEOUT_MS })
  // small extra wait for late-rendered images
  await page.waitForTimeout(800)

  // ⚠ The selectors below are intentionally broad because Kakao ships hashed
  // CSS-module class names that vary by deploy. After the first --headed run,
  // tighten these to the actual class names you observe in DevTools.
  const raw = await page.evaluate(() => {
    function isInGallery(el: Element): boolean {
      return !!el.closest(
        '[class*="photo"], [class*="gallery"], [class*="Photo"], [class*="Gallery"]'
      )
    }
    const imgs = Array.from(document.querySelectorAll('img')).map((el) => ({
      src: (el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src,
      width: (el as HTMLImageElement).naturalWidth || (el as HTMLImageElement).width,
      height: (el as HTMLImageElement).naturalHeight || (el as HTMLImageElement).height,
      inGallery: isInGallery(el),
    }))
    const menuEl = document.querySelector(
      '[class*="menu"], [class*="Menu"]'
    ) as HTMLElement | null
    const categoryEl = document.querySelector(
      '[class*="category"], [class*="Category"]'
    ) as HTMLElement | null
    return {
      imgs,
      menuText: menuEl?.innerText ?? '',
      categoryText: categoryEl?.innerText ?? document.title ?? '',
    }
  })

  const images: RawImage[] = raw.imgs.map((i) => ({
    src: i.src,
    width: i.width,
    height: i.height,
    inGallery: i.inGallery,
  }))

  return {
    images,
    menuText: raw.menuText,
    categoryText: raw.categoryText,
  }
}

// ---------------------------------------------------------------------------
// Supabase: write patch
// ---------------------------------------------------------------------------

async function writeUpdate(
  supabase: ReturnType<typeof createAdminClient>,
  row: RowToScrape,
  result: ReturnType<typeof buildScrapeResult>
): Promise<void> {
  const patch: Record<string, unknown> = {
    cover_photo_url: result.cover_photo_url,
    photo_candidates: result.photo_candidates,
    dish_tags: result.dish_tags,
    enrichment_confidence: result.enrichment_confidence,
    needs_review: result.needs_review,
    review_reason: result.review_reason,
    last_verified_at: new Date().toISOString(),
  }
  // Dietary flags: ONLY include if evidence was found, so existing TRUE values
  // are never clobbered to NULL by a re-scrape that didn't see the keyword.
  if (result.has_vegan_options !== null) patch.has_vegan_options = result.has_vegan_options
  if (result.has_vegetarian_options !== null)
    patch.has_vegetarian_options = result.has_vegetarian_options
  if (result.is_halal !== null) patch.is_halal = result.is_halal

  const { error } = await supabase.from('restaurants').update(patch).eq('id', row.id)
  if (error) throw new Error(`Update failed for ${row.id}: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  console.log(`Scraping run — mode: ${DRY_RUN ? 'DRY RUN' : 'WRITE'}`)
  console.log(
    `Settings: concurrency=${CONCURRENCY}, delay=${DELAY_MS}ms, headed=${HEADED}, force=${FORCE}, limit=${LIMIT ?? 'unlimited'}, id=${ID ?? 'all'}`
  )

  const supabase = createAdminClient()
  const allCandidates = await fetchRows(supabase)
  const skipped = FORCE || ID
    ? 0
    : allCandidates.filter((r) => r.last_verified_at !== null).length
  const rows = allCandidates
  console.log(
    `Fetched ${rows.length} rows${skipped ? ` (skipped ${skipped} already-verified)` : ''}`
  )
  if (rows.length === 0) {
    console.log('Nothing to scrape.')
    return
  }

  const browser = await chromium.launch({ headless: !HEADED })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'ko-KR',
  })

  const stats: RunStats = {
    ok: 0,
    failed: 0,
    byConfidence: { high: 0, medium: 0, low: 0 },
    needsReview: 0,
  }

  const queue = [...rows]

  async function worker(): Promise<void> {
    const page = await context.newPage()
    try {
      while (queue.length) {
        const row = queue.shift()!
        try {
          const scraped = await scrapeOne(page, row.kakao_place_id)
          const result = buildScrapeResult(scraped)
          stats.byConfidence[result.enrichment_confidence]++
          if (result.needs_review) stats.needsReview++

          if (DRY_RUN) {
            console.log(
              `[dry-run] ${row.id} (${row.name_ko}) confidence=${result.enrichment_confidence}`
            )
            console.log(JSON.stringify(result, null, 2))
          } else {
            await writeUpdate(supabase, row, result)
            console.log(
              `[ok] ${row.id} (${row.name_ko}) confidence=${result.enrichment_confidence}${
                result.needs_review ? ' [REVIEW]' : ''
              }`
            )
          }
          stats.ok++
        } catch (err) {
          stats.failed++
          console.error(
            `[FAIL] ${row.id} (${row.name_ko}): ${(err as Error).message}`
          )
        }
        if (CONCURRENCY === 1 && queue.length > 0) await sleep(DELAY_MS)
      }
    } finally {
      await page.close()
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
  await browser.close()

  console.log('')
  console.log('Scraping complete.')
  console.log(`  ok:     ${stats.ok}`)
  console.log(`  failed: ${stats.failed}`)
  console.log(
    `  Confidence: high=${stats.byConfidence.high} medium=${stats.byConfidence.medium} low=${stats.byConfidence.low}`
  )
  if (stats.needsReview > 0 && !DRY_RUN) {
    console.log(
      `  Needs review: ${stats.needsReview} rows — open Supabase Studio and filter needs_review=true`
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
