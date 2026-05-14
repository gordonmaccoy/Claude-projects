/**
 * Seed restaurants from a list of Kakao Place URLs.
 *
 * Input file format (one entry per line):
 *   https://place.map.kakao.com/{id}              # no English name
 *   https://place.map.kakao.com/{id} | English Name
 *   # Lines starting with # and blank lines are ignored
 *
 * Workflow per URL:
 *   1. Parse {id} from URL
 *   2. Skip if already in the DB (kakao_place_id is UNIQUE)
 *   3. Open the Kakao Place page in Playwright
 *   4. Extract name_ko (from <title>), address_ko, phone (from page body)
 *   5. Call Kakao Local API address.json to resolve lat/lng
 *   6. Insert a draft row with cuisine='mexican', source='manual'
 *
 * After this script: run `pnpm scrape` to enrich photos / dish_tags / dietary flags.
 *
 * USAGE
 *   pnpm seed:urls path/to/urls.txt
 *   pnpm seed:urls path/to/urls.txt -- --dry-run
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import fs from 'fs'
import { chromium, type Page } from 'playwright'
import { createAdminClient } from '../lib/supabase/admin'
import { extractNeighborhood } from './lib/normalize'

const DRY_RUN = process.argv.includes('--dry-run')
const DELAY_MS = 2000

interface UrlEntry {
  kakao_place_id: string
  name_en: string | null
  raw: string
}

interface ScrapedBasics {
  name_ko: string
  address_ko: string
  phone: string | null
}

interface ResolvedCoords {
  lat: number
  lng: number
  normalized_address: string
}

interface RowToInsert {
  kakao_place_id: string
  slug: string
  name_ko: string
  name_en: string | null
  address_ko: string
  neighborhood: string | null
  lat: number
  lng: number
  phone: string | null
  cuisine: 'mexican'
  source: 'manual'
  status: 'draft'
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseFilePath(): string {
  // Skip flags; first non-flag arg after the script name is the file path
  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith('--')) return arg
  }
  throw new Error('Usage: pnpm seed:urls <path-to-urls.txt> [-- --dry-run]')
}

const URL_FILE = parseFilePath()

// ---------------------------------------------------------------------------
// File parsing
// ---------------------------------------------------------------------------

function parseUrlFile(path: string): UrlEntry[] {
  const content = fs.readFileSync(path, 'utf8')
  const entries: UrlEntry[] = []
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const [urlPart, ...rest] = line.split('|')
    const url = (urlPart ?? '').trim()
    const nameEn = rest.length > 0 ? rest.join('|').trim() : null
    const m = url.match(/place\.map\.kakao\.com\/(\d+)/)
    if (!m) {
      console.warn(`[skip] could not parse place_id from line: ${line}`)
      continue
    }
    entries.push({
      kakao_place_id: m[1],
      name_en: nameEn && nameEn.length > 0 ? nameEn : null,
      raw: line,
    })
  }
  // Dedupe within the input file
  const seen = new Set<string>()
  const deduped: UrlEntry[] = []
  for (const e of entries) {
    if (seen.has(e.kakao_place_id)) continue
    seen.add(e.kakao_place_id)
    deduped.push(e)
  }
  return deduped
}

// ---------------------------------------------------------------------------
// Scrape basics from the Kakao Place page
// ---------------------------------------------------------------------------

async function scrapeBasics(page: Page, kakaoPlaceId: string): Promise<ScrapedBasics | null> {
  const url = `https://place.map.kakao.com/${kakaoPlaceId}`
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(600)
  } catch (err) {
    console.error(`[fail] navigation timeout for ${kakaoPlaceId}: ${(err as Error).message}`)
    return null
  }

  const raw = await page.evaluate(() => {
    const title = document.title || ''
    // Body text contains pseudo-labels like "주소\n<address>" and "전화\n<phone>".
    // Reliable for now; if Kakao changes their layout we'll need to update.
    const bodyText = document.body?.innerText ?? ''
    return { title, bodyText }
  })

  // name_ko: strip the trailing " | 카카오맵" / " | 카카오지도"
  const name_ko = raw.title
    .replace(/\s*\|\s*카카오(맵|지도)\s*$/, '')
    .trim()

  // Address: find the line right after "주소" and strip "(우)..." postcode suffix and "복사펼치기" UI text
  const addressMatch = raw.bodyText.match(/(?:^|\n)\s*주소\s*\n\s*([^\n]+)/)
  let address_ko: string | null = null
  if (addressMatch) {
    address_ko = addressMatch[1]
      .replace(/\s*\(우\)\d+.*$/, '')
      .replace(/\s*복사.*$/, '')
      .trim()
  }

  // Phone: line after "전화", strip "복사..." suffix
  const phoneMatch = raw.bodyText.match(/(?:^|\n)\s*전화\s*\n\s*([^\n]+)/)
  let phone: string | null = null
  if (phoneMatch) {
    phone = phoneMatch[1].replace(/\s*복사.*$/, '').trim()
    if (phone.length === 0 || phone === '-') phone = null
  }

  if (!name_ko || !address_ko) {
    console.error(
      `[fail] extraction incomplete for ${kakaoPlaceId} — name_ko="${name_ko}", address="${address_ko}"`
    )
    return null
  }

  return { name_ko, address_ko, phone }
}

// ---------------------------------------------------------------------------
// Resolve lat/lng via Kakao Local API
// ---------------------------------------------------------------------------

async function resolveCoords(address: string): Promise<ResolvedCoords | null> {
  const key = process.env.KAKAO_REST_API_KEY
  if (!key) throw new Error('Missing KAKAO_REST_API_KEY')

  const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } })
  if (!res.ok) {
    console.error(`[fail] address.json HTTP ${res.status} for "${address}"`)
    return null
  }
  const data = (await res.json()) as {
    documents: Array<{ x: string; y: string; address_name: string }>
  }
  const doc = data.documents[0]
  if (!doc) {
    // Fallback: try keyword.json with the same string
    const url2 = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(address)}`
    const res2 = await fetch(url2, { headers: { Authorization: `KakaoAK ${key}` } })
    if (!res2.ok) {
      console.error(`[fail] keyword.json fallback HTTP ${res2.status} for "${address}"`)
      return null
    }
    const data2 = (await res2.json()) as {
      documents: Array<{ x: string; y: string; address_name: string }>
    }
    const doc2 = data2.documents[0]
    if (!doc2) return null
    return {
      lat: parseFloat(doc2.y),
      lng: parseFloat(doc2.x),
      normalized_address: doc2.address_name,
    }
  }
  return {
    lat: parseFloat(doc.y),
    lng: parseFloat(doc.x),
    normalized_address: doc.address_name,
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  console.log(`Seeding from URL file: ${URL_FILE} (mode: ${DRY_RUN ? 'DRY RUN' : 'WRITE'})`)

  const entries = parseUrlFile(URL_FILE)
  console.log(`Parsed ${entries.length} unique URL entries`)
  if (entries.length === 0) return

  const supabase = createAdminClient()

  // Find which IDs already exist
  const ids = entries.map((e) => e.kakao_place_id)
  const { data: existing, error: existingErr } = await supabase
    .from('restaurants')
    .select('kakao_place_id')
    .in('kakao_place_id', ids)
  if (existingErr) throw new Error(`Failed to query existing: ${existingErr.message}`)
  const existingSet = new Set((existing ?? []).map((r) => r.kakao_place_id as string))
  const toProcess = entries.filter((e) => !existingSet.has(e.kakao_place_id))
  console.log(
    `${existingSet.size} already in DB (will skip); processing ${toProcess.length} new`
  )
  if (toProcess.length === 0) return

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'ko-KR',
  })
  const page = await context.newPage()

  const stats = { ok: 0, failed: 0, skipped: 0 }
  const rowsToInsert: RowToInsert[] = []

  for (let i = 0; i < toProcess.length; i++) {
    const entry = toProcess[i]
    console.log(`\n[${i + 1}/${toProcess.length}] ${entry.kakao_place_id} ${entry.name_en ? `(${entry.name_en})` : ''}`)

    const basics = await scrapeBasics(page, entry.kakao_place_id)
    if (!basics) {
      stats.failed++
      await sleep(DELAY_MS)
      continue
    }

    const coords = await resolveCoords(basics.address_ko)
    if (!coords) {
      console.error(`[fail] could not resolve coords for ${entry.kakao_place_id}: "${basics.address_ko}"`)
      stats.failed++
      await sleep(DELAY_MS)
      continue
    }

    const row: RowToInsert = {
      kakao_place_id: entry.kakao_place_id,
      slug: `place-${entry.kakao_place_id}`,
      name_ko: basics.name_ko,
      name_en: entry.name_en,
      address_ko: basics.address_ko,
      neighborhood: extractNeighborhood(basics.address_ko),
      lat: coords.lat,
      lng: coords.lng,
      phone: basics.phone,
      cuisine: 'mexican',
      source: 'manual',
      status: 'draft',
    }

    console.log(
      `  ${row.name_ko} | ${row.name_en ?? '—'} | ${row.neighborhood ?? '?'} | ${row.lat.toFixed(4)},${row.lng.toFixed(4)}`
    )
    rowsToInsert.push(row)
    stats.ok++
    await sleep(DELAY_MS)
  }

  await browser.close()

  if (DRY_RUN) {
    console.log(`\nDry run — would insert ${rowsToInsert.length} rows. Skipping write.`)
  } else if (rowsToInsert.length > 0) {
    const { error } = await supabase
      .from('restaurants')
      .upsert(rowsToInsert, { onConflict: 'kakao_place_id', ignoreDuplicates: true })
    if (error) {
      console.error(`Upsert failed: ${error.message}`)
      process.exit(1)
    }
    console.log(`\nInserted ${rowsToInsert.length} rows.`)
  }

  console.log(`\nSummary: ok=${stats.ok} failed=${stats.failed} skipped(existing)=${existingSet.size}`)
  if (!DRY_RUN && stats.ok > 0) {
    console.log(`\nNext: run \`pnpm scrape\` to enrich the new rows with photos and dish tags.`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
