# Restaurant Listing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-rendered restaurant listing pages at `/` (live) and `/curate` (drafts) with neighborhood filtering, in Korean and English.

**Architecture:** Thin Supabase data layer (`lib/restaurants.ts`) feeds three server components (`RestaurantCard`, `NeighborhoodFilter`, `RestaurantList`). Filter state lives in URL search params; the entire page re-renders server-side on chip click. No client components, no React state.

**Tech Stack:** Next.js 16 App Router, server components, `@supabase/ssr`, `next-intl` v4, Tailwind v4

**Spec:** `docs/specs/2026-04-23-restaurant-listing-page-design.md`

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Modify | `taco-tracker/messages/ko.json` | Add `listing.*` keys |
| Modify | `taco-tracker/messages/en.json` | Add `listing.*` keys |
| Create | `taco-tracker/i18n/navigation.ts` | Locale-aware `Link` helper (next-intl v4 pattern) |
| Create | `taco-tracker/lib/restaurants.ts` | Data access: `getRestaurants`, `getNeighborhoods`, `dedupeNeighborhoods`, types |
| Create | `taco-tracker/tests/restaurants.test.ts` | Pure-function tests for `dedupeNeighborhoods` |
| Create | `taco-tracker/components/restaurant-card.tsx` | Horizontal row card, links to Kakao Place |
| Create | `taco-tracker/components/neighborhood-filter.tsx` | Chip row using `<Link>` |
| Create | `taco-tracker/components/restaurant-list.tsx` | Filter + count + cards + empty state |
| Modify | `taco-tracker/app/[locale]/page.tsx` | Render `<RestaurantList status="live" />` |
| Create | `taco-tracker/app/[locale]/curate/page.tsx` | Curator banner + `<RestaurantList status="draft" />`, noindex |

---

## Task 1: i18n keys

**Files:**
- Modify: `taco-tracker/messages/ko.json`
- Modify: `taco-tracker/messages/en.json`

- [ ] **Step 1: Add Korean translations**

Replace the file contents at `taco-tracker/messages/ko.json` with:

```json
{
  "site": {
    "name": "타코 트래커 코리아",
    "tagline": "서울 최고의 멕시코 음식을 찾아보세요"
  },
  "nav": {
    "map": "지도",
    "suggest": "장소 제안",
    "about": "소개"
  },
  "home": {
    "heading": "서울의 타코 & 멕시코 음식"
  },
  "listing": {
    "title": "서울의 타코 & 멕시코 음식",
    "allNeighborhoods": "전체",
    "resultCountAll": "전체 {count}개 식당",
    "resultCountFiltered": "{neighborhood} {count}개 식당",
    "emptyState": "조건에 맞는 식당이 없습니다.",
    "curatorBanner": "큐레이션 모드 — 검토 대기 중인 식당 {count}개",
    "curateTitle": "큐레이션 — 초안 식당",
    "dietary": {
      "halal": "할랄",
      "vegan": "비건",
      "vegetarian": "채식"
    }
  }
}
```

- [ ] **Step 2: Add English translations**

Replace the file contents at `taco-tracker/messages/en.json` with:

```json
{
  "site": {
    "name": "Taco Tracker Korea",
    "tagline": "Find the best Mexican food in Seoul"
  },
  "nav": {
    "map": "Map",
    "suggest": "Suggest a Spot",
    "about": "About"
  },
  "home": {
    "heading": "Tacos & Mexican Food in Seoul"
  },
  "listing": {
    "title": "Tacos & Mexican Food in Seoul",
    "allNeighborhoods": "All",
    "resultCountAll": "{count, plural, =1 {1 restaurant} other {# restaurants}}",
    "resultCountFiltered": "{count, plural, =1 {1 restaurant in {neighborhood}} other {# restaurants in {neighborhood}}}",
    "emptyState": "No restaurants match these filters.",
    "curatorBanner": "{count, plural, =1 {Draft mode — 1 restaurant pending review} other {Draft mode — # restaurants pending review}}",
    "curateTitle": "Curate — Draft restaurants",
    "dietary": {
      "halal": "Halal",
      "vegan": "Vegan",
      "vegetarian": "Vegetarian"
    }
  }
}
```

- [ ] **Step 3: Verify tests still pass**

Run from `taco-tracker/`:
```bash
pnpm vitest run
```
Expected: All 83 tests pass.

- [ ] **Step 4: Commit**

```bash
git add taco-tracker/messages/ko.json taco-tracker/messages/en.json
git commit -m "feat: add listing page i18n keys"
```

---

## Task 2: i18n navigation helper

**Files:**
- Create: `taco-tracker/i18n/navigation.ts`

The next-intl v4 pattern requires a `navigation.ts` module that exports locale-aware `Link`. Without it, internal links won't honor `localePrefix: 'as-needed'`.

- [ ] **Step 1: Create the navigation module**

Create `taco-tracker/i18n/navigation.ts`:

```typescript
import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from `taco-tracker/`:
```bash
pnpm tsc --noEmit
```
Expected: No new errors. (Pre-existing errors unrelated to this file are OK — note them but don't fix.)

- [ ] **Step 3: Commit**

```bash
git add taco-tracker/i18n/navigation.ts
git commit -m "feat: add next-intl navigation helpers"
```

---

## Task 3: Data layer with tests

**Files:**
- Create: `taco-tracker/lib/restaurants.ts`
- Create: `taco-tracker/tests/restaurants.test.ts`

Approach: `getRestaurants` and `getNeighborhoods` accept a `SupabaseClient` (dependency injection) so they're easy to call from server components. The deduplication/sorting logic is extracted into a pure function `dedupeNeighborhoods` which is what we actually test. The Supabase wrappers are thin enough to verify manually.

- [ ] **Step 1: Write failing test for `dedupeNeighborhoods`**

Create `taco-tracker/tests/restaurants.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { dedupeNeighborhoods } from '../lib/restaurants'

describe('dedupeNeighborhoods', () => {
  it('returns unique neighborhoods sorted ascending', () => {
    const rows = [
      { neighborhood: '용산구' },
      { neighborhood: '강남구' },
      { neighborhood: '용산구' },
      { neighborhood: '마포구' },
    ]
    expect(dedupeNeighborhoods(rows)).toEqual(['강남구', '마포구', '용산구'])
  })

  it('filters out null neighborhoods', () => {
    const rows = [
      { neighborhood: '용산구' },
      { neighborhood: null },
      { neighborhood: '강남구' },
    ]
    expect(dedupeNeighborhoods(rows)).toEqual(['강남구', '용산구'])
  })

  it('returns empty array for empty input', () => {
    expect(dedupeNeighborhoods([])).toEqual([])
  })

  it('returns empty array when all neighborhoods are null', () => {
    expect(dedupeNeighborhoods([{ neighborhood: null }, { neighborhood: null }])).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/restaurants.test.ts
```
Expected: FAIL with "Cannot find module '../lib/restaurants'"

- [ ] **Step 3: Create the data layer**

Create `taco-tracker/lib/restaurants.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

export type RestaurantStatus = 'draft' | 'live' | 'archived'

export interface Restaurant {
  id: string
  slug: string
  name_ko: string
  name_en: string | null
  neighborhood: string | null
  address_ko: string
  kakao_place_id: string | null
  dish_tags: string[]
  has_vegan_options: boolean | null
  has_vegetarian_options: boolean | null
  is_halal: boolean | null
  cover_photo_url: string | null
  curator_rating: number | null
}

const RESTAURANT_COLUMNS =
  'id, slug, name_ko, name_en, neighborhood, address_ko, kakao_place_id, dish_tags, ' +
  'has_vegan_options, has_vegetarian_options, is_halal, cover_photo_url, curator_rating'

export async function getRestaurants(
  supabase: SupabaseClient,
  filters: { status: RestaurantStatus; neighborhood?: string }
): Promise<Restaurant[]> {
  let query = supabase
    .from('restaurants')
    .select(RESTAURANT_COLUMNS)
    .eq('status', filters.status)
    .order('name_ko', { ascending: true })

  if (filters.neighborhood) {
    query = query.eq('neighborhood', filters.neighborhood)
  }

  const { data, error } = await query
  if (error) throw new Error(`Failed to fetch restaurants: ${error.message}`)
  return (data ?? []) as Restaurant[]
}

/**
 * Pure helper: deduplicate, sort, and drop null neighborhoods.
 * Extracted so the logic is testable without mocking Supabase.
 */
export function dedupeNeighborhoods(
  rows: { neighborhood: string | null }[]
): string[] {
  const set = new Set<string>()
  for (const row of rows) {
    if (row.neighborhood !== null) set.add(row.neighborhood)
  }
  return Array.from(set).sort()
}

export async function getNeighborhoods(
  supabase: SupabaseClient,
  status: RestaurantStatus
): Promise<string[]> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('neighborhood')
    .eq('status', status)
    .not('neighborhood', 'is', null)

  if (error) throw new Error(`Failed to fetch neighborhoods: ${error.message}`)
  return dedupeNeighborhoods((data ?? []) as { neighborhood: string | null }[])
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run tests/restaurants.test.ts
```
Expected: All 4 tests pass.

- [ ] **Step 5: Run full test suite to confirm no regression**

```bash
pnpm vitest run
```
Expected: 87 tests pass (83 existing + 4 new).

- [ ] **Step 6: Commit**

```bash
git add taco-tracker/lib/restaurants.ts taco-tracker/tests/restaurants.test.ts
git commit -m "feat: add restaurants data layer with neighborhood dedup"
```

---

## Task 4: RestaurantCard component

**Files:**
- Create: `taco-tracker/components/restaurant-card.tsx`

A server component that takes a `Restaurant` and a `locale` and renders the horizontal row card. The whole card is an `<a>` to the Kakao Place URL.

- [ ] **Step 1: Create the component**

Create `taco-tracker/components/restaurant-card.tsx`:

```tsx
import type { Restaurant } from '@/lib/restaurants'
import { getTranslations } from 'next-intl/server'

interface Props {
  restaurant: Restaurant
  locale: 'ko' | 'en'
}

export async function RestaurantCard({ restaurant, locale }: Props) {
  const t = await getTranslations('listing.dietary')
  const kakaoUrl = restaurant.kakao_place_id
    ? `https://place.map.kakao.com/${restaurant.kakao_place_id}`
    : undefined

  const isKorean = locale === 'ko'
  const primaryName = isKorean
    ? restaurant.name_ko
    : (restaurant.name_en ?? restaurant.name_ko)
  const secondaryName = isKorean
    ? restaurant.name_en
    : (restaurant.name_en ? restaurant.name_ko : null)

  const dietaryFlags = [
    restaurant.is_halal ? { key: 'halal', label: t('halal') } : null,
    restaurant.has_vegan_options ? { key: 'vegan', label: t('vegan') } : null,
    restaurant.has_vegetarian_options && !restaurant.has_vegan_options
      ? { key: 'vegetarian', label: t('vegetarian') }
      : null,
  ].filter((x): x is { key: string; label: string } => x !== null)

  const CardContent = (
    <article className="flex overflow-hidden rounded-md bg-surface shadow-card transition-shadow hover:shadow-[0_4px_12px_rgba(27,25,22,0.12)]">
      <div className="relative h-[60px] w-[80px] shrink-0 bg-gradient-to-br from-[#E8DCC8] to-[#D4C4A8] sm:h-[80px] sm:w-[120px]">
        {restaurant.cover_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={restaurant.cover_photo_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-base font-bold leading-tight text-ink">
              {primaryName}
            </div>
            {secondaryName ? (
              <div className="truncate text-xs text-muted">{secondaryName}</div>
            ) : null}
          </div>
          {restaurant.curator_rating !== null ? (
            <div className="whitespace-nowrap text-sm font-semibold text-brand">
              ★ {restaurant.curator_rating.toFixed(1)}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {restaurant.neighborhood ? (
            <span className="text-xs text-muted">{restaurant.neighborhood}</span>
          ) : null}
          {restaurant.dish_tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-ink bg-bg px-2.5 py-0.5 text-[11px] text-ink"
            >
              {tag}
            </span>
          ))}
          {dietaryFlags.map((flag) => (
            <span
              key={flag.key}
              className="rounded-full border border-accent bg-bg px-2.5 py-0.5 text-[11px] text-accent"
            >
              {flag.label}
            </span>
          ))}
        </div>
        <div className="truncate text-xs text-muted">{restaurant.address_ko}</div>
      </div>
    </article>
  )

  if (kakaoUrl) {
    return (
      <a
        href={kakaoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        {CardContent}
      </a>
    )
  }
  return CardContent
}
```

Notes on Tailwind v4 utility classes: this code uses `bg-surface`, `text-ink`, `text-muted`, `text-brand`, `text-accent`, `bg-bg`, `border-ink`, `border-accent`, `shadow-card`. These map to the `--color-*` tokens defined in `app/globals.css`. Tailwind v4's `@theme` block makes these utilities available automatically — no `tailwind.config.js` needed. Verify they work by visual check in Task 6.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```
Expected: No new errors.

- [ ] **Step 3: Verify tests still pass**

```bash
pnpm vitest run
```
Expected: 87 tests pass.

- [ ] **Step 4: Commit**

```bash
git add taco-tracker/components/restaurant-card.tsx
git commit -m "feat: add RestaurantCard component"
```

---

## Task 5: NeighborhoodFilter component

**Files:**
- Create: `taco-tracker/components/neighborhood-filter.tsx`

Server component that renders a horizontal chip row. Each chip is a `<Link>` from `next-intl/navigation` (so locale prefix is honored). The "All" chip clears the `neighborhood` query param; the rest set it.

- [ ] **Step 1: Create the component**

Create `taco-tracker/components/neighborhood-filter.tsx`:

```tsx
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'

interface Props {
  neighborhoods: string[]
  active: string | null
  basePath: '/' | '/curate'
}

export async function NeighborhoodFilter({ neighborhoods, active, basePath }: Props) {
  const t = await getTranslations('listing')

  return (
    <nav
      aria-label="Neighborhood filter"
      className="flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-x-visible sm:pb-0"
    >
      <Link
        href={basePath}
        className={chipClass(active === null)}
      >
        {t('allNeighborhoods')}
      </Link>
      {neighborhoods.map((n) => (
        <Link
          key={n}
          href={{ pathname: basePath, query: { neighborhood: n } }}
          className={chipClass(active === n)}
        >
          {n}
        </Link>
      ))}
    </nav>
  )
}

function chipClass(isActive: boolean): string {
  const base =
    'whitespace-nowrap rounded-full border px-3.5 py-1 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
  if (isActive) {
    return `${base} border-brand bg-brand text-surface`
  }
  return `${base} border-ink bg-surface text-ink hover:bg-bg`
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add taco-tracker/components/neighborhood-filter.tsx
git commit -m "feat: add NeighborhoodFilter chip row component"
```

---

## Task 6: RestaurantList wrapper + home page

**Files:**
- Create: `taco-tracker/components/restaurant-list.tsx`
- Modify: `taco-tracker/app/[locale]/page.tsx`

`RestaurantList` is a server component that:
1. Creates a Supabase server client
2. Fetches restaurants + neighborhoods (in parallel)
3. Renders filter chips + result count + cards + empty state

The home page becomes a thin wrapper that reads `searchParams.neighborhood` and renders `<RestaurantList status="live" />`.

- [ ] **Step 1: Create the RestaurantList component**

Create `taco-tracker/components/restaurant-list.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { getRestaurants, getNeighborhoods, type RestaurantStatus } from '@/lib/restaurants'
import { getTranslations } from 'next-intl/server'
import { RestaurantCard } from './restaurant-card'
import { NeighborhoodFilter } from './neighborhood-filter'

interface Props {
  status: RestaurantStatus
  neighborhood: string | null
  locale: 'ko' | 'en'
  basePath: '/' | '/curate'
}

export async function RestaurantList({ status, neighborhood, locale, basePath }: Props) {
  const supabase = await createClient()
  const [restaurants, neighborhoods] = await Promise.all([
    getRestaurants(supabase, {
      status,
      neighborhood: neighborhood ?? undefined,
    }),
    getNeighborhoods(supabase, status),
  ])

  const t = await getTranslations('listing')
  const count = restaurants.length

  return (
    <div className="flex flex-col gap-4">
      <NeighborhoodFilter
        neighborhoods={neighborhoods}
        active={neighborhood}
        basePath={basePath}
      />
      <p className="text-sm text-muted">
        {neighborhood
          ? t('resultCountFiltered', { count, neighborhood })
          : t('resultCountAll', { count })}
      </p>
      {count === 0 ? (
        <p className="py-16 text-center text-muted">{t('emptyState')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {restaurants.map((r) => (
            <li key={r.id}>
              <RestaurantCard restaurant={r} locale={locale} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Modify the home page**

Replace contents of `taco-tracker/app/[locale]/page.tsx`:

```tsx
import { getTranslations } from 'next-intl/server'
import { RestaurantList } from '@/components/restaurant-list'

interface Props {
  params: Promise<{ locale: 'ko' | 'en' }>
  searchParams: Promise<{ neighborhood?: string }>
}

export default async function HomePage({ params, searchParams }: Props) {
  const { locale } = await params
  const { neighborhood } = await searchParams
  const t = await getTranslations('listing')

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="mb-6 font-display text-3xl text-ink sm:text-4xl">
        {t('title')}
      </h1>
      <RestaurantList
        status="live"
        neighborhood={neighborhood ?? null}
        locale={locale}
        basePath="/"
      />
    </main>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```
Expected: No new errors.

- [ ] **Step 4: Verify tests still pass**

```bash
pnpm vitest run
```
Expected: 87 tests pass.

- [ ] **Step 5: Smoke-test the dev server**

```bash
pnpm dev
```

Open `http://localhost:3000/` in a browser. Since no rows have `status='live'` yet, expect the empty-state message: "조건에 맞는 식당이 없습니다." This confirms the page renders end-to-end. Stop the server with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add taco-tracker/components/restaurant-list.tsx taco-tracker/app/[locale]/page.tsx
git commit -m "feat: render RestaurantList on home page"
```

---

## Task 7: Curate page

**Files:**
- Create: `taco-tracker/app/[locale]/curate/page.tsx`

A near-clone of the home page that filters `status='draft'`. Adds a banner showing the draft count and sets `robots: { index: false }` so search engines skip it.

- [ ] **Step 1: Create the curate page**

Create `taco-tracker/app/[locale]/curate/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { RestaurantList } from '@/components/restaurant-list'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

interface Props {
  params: Promise<{ locale: 'ko' | 'en' }>
  searchParams: Promise<{ neighborhood?: string }>
}

export default async function CuratePage({ params, searchParams }: Props) {
  const { locale } = await params
  const { neighborhood } = await searchParams
  const t = await getTranslations('listing')

  const supabase = await createClient()
  const { count } = await supabase
    .from('restaurants')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'draft')

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-4 rounded-md border border-brand-deep bg-bg px-4 py-2 text-sm text-brand-deep">
        {t('curatorBanner', { count: count ?? 0 })}
      </div>
      <h1 className="mb-6 font-display text-3xl text-ink sm:text-4xl">
        {t('curateTitle')}
      </h1>
      <RestaurantList
        status="draft"
        neighborhood={neighborhood ?? null}
        locale={locale}
        basePath="/curate"
      />
    </main>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```
Expected: No new errors.

- [ ] **Step 3: Verify tests still pass**

```bash
pnpm vitest run
```
Expected: 87 tests pass.

- [ ] **Step 4: Smoke-test the dev server**

```bash
pnpm dev
```

Open in a browser:
- `http://localhost:3000/curate` — expect "큐레이션 모드 — 검토 대기 중인 식당 108개", filter chips for each district, and 108 horizontal-row cards
- Click a neighborhood chip — URL becomes `/curate?neighborhood=용산구`, list filters to that neighborhood
- Click "전체" chip — URL becomes `/curate`, all rows return
- Click a card — opens Kakao Place page in a new tab
- `http://localhost:3000/en/curate` — same page in English
- View page source — `<meta name="robots" content="noindex, nofollow">` present

Stop the server with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add taco-tracker/app/[locale]/curate/page.tsx
git commit -m "feat: add curate page for draft restaurants"
```

---

## Deferred from Spec

The spec lists three test categories. This plan implements one and defers the other two:

- ✅ **Unit tests for `lib/restaurants.ts`** — implemented in Task 3 via `dedupeNeighborhoods` (the only non-trivial logic). The Supabase wrappers are too thin to test without testing the mock.
- ❌ **Component tests for `<RestaurantCard>`** — deferred. The project has no React testing infrastructure (`vitest.config.ts` uses `environment: 'node'`, no `@testing-library/react`, no jsdom). Adding it is its own plan-sized task. Manual verification (Task 6 Step 5, Task 7 Step 4) covers the visual states.
- ❌ **Integration tests rendering `/` and `/curate`** — deferred. Same reason. Smoke-test against the dev server covers the live path.

When React testing infrastructure is added later, these tests should be added back.

---

## Verification

After all tasks complete:

**1. Run tests:**
```bash
cd taco-tracker && pnpm vitest run
```
Expected: 87 tests pass (83 existing + 4 new for `dedupeNeighborhoods`).

**2. TypeScript check:**
```bash
cd taco-tracker && pnpm tsc --noEmit
```
Expected: No new errors.

**3. Manual end-to-end verification with the dev server:**

```bash
cd taco-tracker && pnpm dev
```

Then verify each:

- `http://localhost:3000/` → empty state ("조건에 맞는 식당이 없습니다.")
- `http://localhost:3000/en` → same, English ("No restaurants match these filters.")
- `http://localhost:3000/curate` → banner showing "큐레이션 모드 — 검토 대기 중인 식당 108개", filter chips visible, 108 cards
- Click 용산구 chip → URL `/curate?neighborhood=용산구`, count drops, only 용산구 rows shown
- Click 전체 chip → all 108 return
- Click any card → opens `https://place.map.kakao.com/<id>` in new tab
- `http://localhost:3000/en/curate` → same page, English chrome
- View page source on `/curate` → confirm `<meta name="robots" content="noindex, nofollow">` present
- Resize browser to ≤480px width → photo shrinks, chips scroll horizontally, address truncates

**4. Promote one row to test live filter:**

In Supabase Table Editor, flip one restaurant from `status='draft'` to `status='live'`. Reload `http://localhost:3000/` and verify that row appears.
