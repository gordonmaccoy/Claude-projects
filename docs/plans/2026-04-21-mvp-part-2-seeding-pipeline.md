# Taco Tracker Korea — MVP Part 2: Kakao Seeding Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A one-shot TypeScript script that queries the Kakao Local Search API for Mexican restaurants in Seoul, deduplicates results, normalizes them into the `restaurants` schema, and upserts them as `status='draft'` rows into Supabase — producing ≥50 draft rows ready for curator review.

**Architecture:** Three focused modules in `scripts/lib/` with clear boundaries: `kakao-client.ts` handles HTTP only, `normalize.ts` is a pure transform with no side-effects, and `supabase-seed.ts` handles the DB write. The entry point `scripts/seed-from-kakao.ts` loads env vars and orchestrates the pipeline. Run locally with `pnpm seed`; never deployed.

**Tech Stack:** tsx (run TypeScript directly), dotenv, @supabase/supabase-js, Kakao Local Search REST API, Vitest.

---

## Prerequisites (complete before Task 6)

You need a Kakao REST API key before running the seed script. The Kakao developer account was set up in Part 1.

1. Go to [developers.kakao.com](https://developers.kakao.com) → 내 애플리케이션 (My Applications)
2. Click your app → look for **REST API 키** on the summary page
3. Copy it — you'll add it to `.env.local` as `KAKAO_REST_API_KEY=your-key` in Task 1

---

## File Structure

All paths relative to `taco-tracker/`.

```
scripts/
├── seed-from-kakao.ts        # entry point: loads env, orchestrates pipeline, prints summary
└── lib/
    ├── kakao-client.ts       # fetchPage(), fetchAllPlaces(), parseKakaoResponse() — HTTP only
    ├── normalize.ts          # normalize(), generateSlug(), extractNeighborhood() — pure functions
    └── supabase-seed.ts      # upsertDrafts() — DB write via service_role
tests/
├── normalize.test.ts         # thorough unit tests for pure transform functions
└── kakao-client.test.ts      # unit tests for response parsing
```

---

## Task 1: Script environment setup

**Files:**
- Modify: `package.json` (add `seed` script, add tsx + dotenv to devDependencies)
- Modify: `.env.local.example` (add KAKAO_REST_API_KEY)

- [ ] **Step 1: Install tsx and dotenv**

From the `taco-tracker/` directory:

```bash
pnpm add -D tsx dotenv
```

Expected: `tsx` and `dotenv` appear in `devDependencies` in `package.json`.

- [ ] **Step 2: Add the seed script to `package.json`**

In the `"scripts"` section, add one line:

```json
"seed": "tsx scripts/seed-from-kakao.ts"
```

The full scripts section should now look like:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "test": "vitest run",
  "test:watch": "vitest",
  "seed": "tsx scripts/seed-from-kakao.ts"
}
```

- [ ] **Step 3: Update `.env.local.example`**

Replace the entire file with:

```bash
# Copy to .env.local and fill in from Supabase Dashboard → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Kakao developer console → My Applications → your app → REST API 키
KAKAO_REST_API_KEY=your-kakao-rest-api-key
```

- [ ] **Step 4: Add `KAKAO_REST_API_KEY` to your `.env.local`** (manual)

Open `.env.local` in a text editor and add:

```
KAKAO_REST_API_KEY=your-actual-key-here
```

- [ ] **Step 5: Commit**

```bash
git add package.json .env.local.example
git commit -m "chore: add tsx + dotenv for seeding script, add KAKAO_REST_API_KEY to env template"
```

---

## Task 2: Kakao API client

**Files:**
- Create: `scripts/lib/kakao-client.ts`
- Create: `tests/kakao-client.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `tests/kakao-client.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run to confirm they fail**

```bash
pnpm test tests/kakao-client.test.ts
```

Expected: FAIL — `Cannot find module '../scripts/lib/kakao-client'`

- [ ] **Step 3: Create `scripts/lib/kakao-client.ts`**

```typescript
const KAKAO_API_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json'
const SEOUL_RECT = '126.734086,37.413294,127.269311,37.715133'
const MAX_PAGE = 45
const PAGE_SIZE = 15

export interface KakaoPlace {
  id: string
  place_name: string
  phone: string
  address_name: string
  road_address_name: string
  x: string // longitude
  y: string // latitude
  place_url: string
  category_name: string
}

interface KakaoSearchResponse {
  documents: KakaoPlace[]
  meta: {
    total_count: number
    pageable_count: number
    is_end: boolean
  }
}

export function parseKakaoResponse(json: KakaoSearchResponse): {
  places: KakaoPlace[]
  isEnd: boolean
} {
  return {
    places: json.documents,
    isEnd: json.meta.is_end,
  }
}

export async function fetchPage(
  query: string,
  page: number,
  apiKey: string
): Promise<{ places: KakaoPlace[]; isEnd: boolean }> {
  const params = new URLSearchParams({
    query,
    page: String(page),
    size: String(PAGE_SIZE),
    rect: SEOUL_RECT,
  })
  const res = await fetch(`${KAKAO_API_URL}?${params}`, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
  })
  if (!res.ok) {
    throw new Error(`Kakao API error: ${res.status} ${res.statusText}`)
  }
  const json = (await res.json()) as KakaoSearchResponse
  return parseKakaoResponse(json)
}

export async function fetchAllPlaces(
  query: string,
  apiKey: string
): Promise<KakaoPlace[]> {
  const all: KakaoPlace[] = []
  for (let page = 1; page <= MAX_PAGE; page++) {
    const { places, isEnd } = await fetchPage(query, page, apiKey)
    all.push(...places)
    if (isEnd) break
  }
  return all
}
```

- [ ] **Step 4: Run tests — expect 4 passing**

```bash
pnpm test tests/kakao-client.test.ts
```

Expected:
```
✓ tests/kakao-client.test.ts (4)
  ✓ parseKakaoResponse > extracts places from documents array
  ✓ parseKakaoResponse > reads isEnd from meta
  ✓ parseKakaoResponse > returns isEnd false when there are more pages
  ✓ parseKakaoResponse > returns empty places when documents is empty
```

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/kakao-client.ts tests/kakao-client.test.ts
git commit -m "feat: add Kakao Local Search API client with pagination"
```

---

## Task 3: Normalize function

**Files:**
- Create: `scripts/lib/normalize.ts`
- Create: `tests/normalize.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/normalize.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run to confirm they fail**

```bash
pnpm test tests/normalize.test.ts
```

Expected: FAIL — `Cannot find module '../scripts/lib/normalize'`

- [ ] **Step 3: Create `scripts/lib/normalize.ts`**

```typescript
import type { KakaoPlace } from './kakao-client'

export interface RestaurantDraft {
  kakao_place_id: string
  slug: string
  name_ko: string
  address_ko: string
  neighborhood: string | null
  lat: number
  lng: number
  phone: string | null
  cuisine: string
  source: string
  status: string
}

export function generateSlug(place: KakaoPlace): string {
  return `place-${place.id}`
}

export function extractNeighborhood(address: string): string | null {
  const match = address.match(/(\S+구)/)
  return match ? match[1] : null
}

export function normalize(place: KakaoPlace): RestaurantDraft {
  const address = place.road_address_name || place.address_name
  return {
    kakao_place_id: place.id,
    slug: generateSlug(place),
    name_ko: place.place_name,
    address_ko: address,
    neighborhood: extractNeighborhood(address),
    lat: parseFloat(place.y),
    lng: parseFloat(place.x),
    phone: place.phone || null,
    cuisine: 'mexican',
    source: 'kakao',
    status: 'draft',
  }
}
```

- [ ] **Step 4: Run all tests — expect 14 existing + 14 new = 32 passing**

```bash
pnpm test
```

Expected:
```
✓ tests/i18n.test.ts (2)
✓ tests/supabase-client.test.ts (2)
✓ tests/schema.test.ts (10)
✓ tests/kakao-client.test.ts (4)
✓ tests/normalize.test.ts (14)

Test Files  5 passed (5)
Tests  32 passed (32)
```

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/normalize.ts tests/normalize.test.ts
git commit -m "feat: add normalize function to map KakaoPlace to RestaurantDraft"
```

---

## Task 4: Supabase upsert module

**Files:**
- Create: `scripts/lib/supabase-seed.ts`
- Create: `tests/supabase-seed.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/supabase-seed.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('supabase-seed', () => {
  it('exports upsertDrafts as a function', async () => {
    const mod = await import('../scripts/lib/supabase-seed')
    expect(typeof mod.upsertDrafts).toBe('function')
  })
})
```

- [ ] **Step 2: Run to confirm the new test fails**

```bash
pnpm test tests/supabase-seed.test.ts
```

Expected: FAIL — `Cannot find module '../scripts/lib/supabase-seed'`

- [ ] **Step 3: Create `scripts/lib/supabase-seed.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'
import type { RestaurantDraft } from './normalize'

const BATCH_SIZE = 50

export async function upsertDrafts(
  drafts: RestaurantDraft[]
): Promise<{ inserted: number }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment'
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  let inserted = 0

  for (let i = 0; i < drafts.length; i += BATCH_SIZE) {
    const batch = drafts.slice(i, i + BATCH_SIZE)
    const { data, error } = await supabase
      .from('restaurants')
      .upsert(batch, { onConflict: 'kakao_place_id', ignoreDuplicates: true })
      .select('id')
    if (error) throw new Error(`Supabase upsert failed: ${error.message}`)
    inserted += data?.length ?? 0
  }

  return { inserted }
}
```

- [ ] **Step 4: Run all tests — expect 33 passing**

```bash
pnpm test
```

Expected:
```
✓ tests/i18n.test.ts (2)
✓ tests/supabase-client.test.ts (2)
✓ tests/schema.test.ts (10)
✓ tests/kakao-client.test.ts (4)
✓ tests/normalize.test.ts (14)
✓ tests/supabase-seed.test.ts (1)

Test Files  6 passed (6)
Tests  33 passed (33)
```

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/supabase-seed.ts tests/supabase-seed.test.ts
git commit -m "feat: add Supabase upsert module for seeding draft restaurants"
```

---

## Task 5: Seed orchestrator

**Files:**
- Create: `scripts/seed-from-kakao.ts`

No unit tests for the orchestrator — it's integration glue. Validation happens in Task 6 by running it.

- [ ] **Step 1: Create `scripts/seed-from-kakao.ts`**

```typescript
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { fetchAllPlaces, type KakaoPlace } from './lib/kakao-client'
import { normalize } from './lib/normalize'
import { upsertDrafts } from './lib/supabase-seed'

const KEYWORDS = ['멕시칸', '타코', '부리또', '멕시코음식']

async function main() {
  const apiKey = process.env.KAKAO_REST_API_KEY
  if (!apiKey) {
    throw new Error('Missing KAKAO_REST_API_KEY in .env.local')
  }

  console.log('Seeding from Kakao Local API...')

  const seenIds = new Set<string>()
  const uniquePlaces: KakaoPlace[] = []

  for (const keyword of KEYWORDS) {
    console.log(`\nFetching: "${keyword}"...`)
    const places = await fetchAllPlaces(keyword, apiKey)
    console.log(`  ${places.length} results`)
    for (const place of places) {
      if (!seenIds.has(place.id)) {
        seenIds.add(place.id)
        uniquePlaces.push(place)
      }
    }
  }

  console.log(`\nUnique places after dedup: ${uniquePlaces.length}`)

  const drafts = uniquePlaces.map(normalize)

  console.log('Upserting to Supabase...')
  const { inserted } = await upsertDrafts(drafts)

  console.log('\nDone!')
  console.log(`  Inserted: ${inserted} new draft rows`)
  console.log(`  Skipped:  ${uniquePlaces.length - inserted} already existed`)
  console.log('\nOpen Supabase → Table Editor → restaurants to review drafts.')
}

main().catch((err: Error) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
```

- [ ] **Step 2: Verify the test suite still passes (no regressions)**

```bash
pnpm test
```

Expected: 33 tests, all passing.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-from-kakao.ts
git commit -m "feat: add seed-from-kakao orchestrator script"
```

---

## Task 6: Run the seed and verify

**Prerequisite:** `KAKAO_REST_API_KEY` must be in your `.env.local` (from the Prerequisites section above).

- [ ] **Step 1: Run the seed script**

From the `taco-tracker/` directory:

```bash
pnpm seed
```

Expected output (numbers will vary):

```
Seeding from Kakao Local API...

Fetching: "멕시칸"...
  45 results

Fetching: "타코"...
  60 results

Fetching: "부리또"...
  30 results

Fetching: "멕시코음식"...
  15 results

Unique places after dedup: 87

Upserting to Supabase...

Done!
  Inserted: 87 new draft rows
  Skipped:  0 already existed

Open Supabase → Table Editor → restaurants to review drafts.
```

If you see an error about `KAKAO_REST_API_KEY`, confirm the key is in `.env.local` (not just `.env.local.example`).

- [ ] **Step 2: Verify in Supabase dashboard**

Open Supabase Dashboard → Table Editor → `restaurants`. You should see rows with:
- `status = 'draft'`
- `source = 'kakao'`
- `cuisine = 'mexican'`
- `name_ko` populated with Korean restaurant names
- `lat` / `lng` within Seoul bounds (lat ~37.4–37.7, lng ~126.7–127.3)

Confirm at least 50 rows are present. If fewer than 50, check that your Kakao REST API key has the Local Search API enabled (Kakao console → Products → 로컬).

- [ ] **Step 3: Re-run is safe**

Running `pnpm seed` again should show:

```
Inserted: 0 new draft rows
Skipped:  87 already existed
```

This confirms the `ON CONFLICT DO NOTHING` dedup is working.

---

## After Part 2

The next curator step (not automated) is to open each `draft` row in Supabase and fill in:
- `style` — pick from the restaurant_style enum
- `dish_tags` — from the controlled vocabulary in `schema.md`
- `price_band` — 1 / 2 / 3
- `curator_rating` — 1.0–5.0
- `curator_note_ko` — under 280 chars, lead with what matters
- `curator_note_en` — peer translation, not machine-translated
- `cover_photo_url` — paste a URL to a real photo
- `cover_photo_alt_ko` / `cover_photo_alt_en` — bilingual alt text
- `status` → flip to `'live'` when the row is complete

**Part 3** will build the map + directory pages that display `status = 'live'` rows.
