# Sprint A — Airbnb Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shift the listing UI to photo-led vertical cards with three filter chip rows (neighborhood / dish / dietary), an anchored pin popover, and a stub restaurant detail page. No auth, no user reviews — Sprint B covers those.

**Architecture:** All UI work, no DB or auth changes. The data layer's filter shape changes (one neighborhood string → arrays per filter dimension). Existing `NeighborhoodFilter` generalizes into a multi-select `FilterChipRow` reused by neighborhood/dish/dietary. Pin popover uses Kakao's native `CustomOverlay` API + React `createPortal` to render React content anchored to a marker. The stub detail page is server-rendered at `/restaurant/[slug]` with a "Reviews coming soon" placeholder.

**Tech Stack:** Next.js 16, TypeScript, Tailwind v4, next-intl v4, Kakao Maps JS SDK, Supabase, Vitest, lucide-react (already installed)

**Spec:** `docs/specs/2026-05-14-airbnb-redesign-sprint-a.md`

---

## Prerequisites (one-time setup, not a code task)

Create a fresh worktree from `main`:

```bash
cd "C:/Users/Admin/OneDrive/Documents/Demos"
git worktree add .claude/worktrees/sprint-a -b claude/sprint-a
cd .claude/worktrees/sprint-a/taco-tracker
pnpm install
cp ../../../taco-tracker/.env.local .env.local
```

All tasks happen in `.claude/worktrees/sprint-a/`.

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Modify | `taco-tracker/lib/restaurants.ts` | Extend `Restaurant` type; replace `getRestaurants` filter shape with arrays; add `getRestaurantBySlug` |
| Modify | `taco-tracker/lib/kakao-maps.ts` | Add `CustomOverlay` to the Kakao type namespace |
| Modify | `taco-tracker/messages/ko.json`, `messages/en.json` | New i18n keys (dish labels, detail page, gallery, etc.) |
| Replace | `taco-tracker/components/filter-chip-row.tsx` (was `neighborhood-filter.tsx`) | Generic multi-select filter chip row |
| Create | `taco-tracker/components/neighborhood-filter.tsx` | Thin wrapper over `FilterChipRow` |
| Create | `taco-tracker/components/dish-filter.tsx` | Thin wrapper over `FilterChipRow` for dish tags |
| Create | `taco-tracker/components/dietary-filter.tsx` | Thin wrapper over `FilterChipRow` for dietary flags (with icons) |
| Modify | `taco-tracker/components/restaurant-card.tsx` | Vertical layout (photo on top); internal `Link` to `/restaurant/[slug]` |
| Modify | `taco-tracker/components/restaurant-list.tsx` | Render 3 filter rows; collect filters; pass to `MapListView` |
| Modify | `taco-tracker/components/map/map-list-view.tsx` | Desktop proportions (map 65 / list 35); pass full restaurants to `KakaoMap` for popover content |
| Create | `taco-tracker/components/map/restaurant-popover.tsx` | Popover JSX (photo + name + tags + dietary icons) |
| Modify | `taco-tracker/components/map/kakao-map.tsx` | `CustomOverlay` lifecycle + React portal for the popover |
| Create | `taco-tracker/components/photo-gallery.tsx` | Thumbnail grid with native `<dialog>` lightbox |
| Create | `taco-tracker/components/restaurant-detail.tsx` | Detail page body (hero, meta, actions, gallery, placeholder) |
| Create | `taco-tracker/app/[locale]/restaurant/[slug]/page.tsx` | Stub detail page route |
| Modify | `taco-tracker/tests/restaurants.test.ts` | New tests for filter construction |

---

## Task 1 — i18n keys

**Files:**
- Modify: `taco-tracker/messages/ko.json`
- Modify: `taco-tracker/messages/en.json`

Sprint A introduces filter labels, dish-tag display names, detail-page action labels, gallery text, and a "reviews coming soon" placeholder. Adding them first unblocks all subsequent UI tasks.

- [ ] **Step 1: Replace `messages/ko.json` with:**

```json
{
  "site": {
    "name": "타코맵",
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
    "resultCountFiltered": "{count}개 식당",
    "emptyState": "조건에 맞는 식당이 없습니다.",
    "curatorBanner": "큐레이션 모드 — 검토 대기 중인 식당 {count}개",
    "curateTitle": "큐레이션 — 초안 식당",
    "mapUnavailable": "지도를 불러올 수 없습니다. 목록만 표시합니다.",
    "tabs": {
      "map": "지도",
      "list": "목록"
    },
    "filters": {
      "neighborhood": "지역",
      "dish": "메뉴",
      "dietary": "식이"
    },
    "dishes": {
      "taco": "타코",
      "burrito": "부리또",
      "quesadilla": "케사디아",
      "fajita": "파히타",
      "nachos": "나초",
      "margarita": "마르가리타",
      "enchilada": "엔칠라다",
      "guacamole": "과카몰리",
      "salsa": "살사",
      "tortilla": "토르티야",
      "chipotle": "치폴레"
    },
    "dietary": {
      "halal": "할랄",
      "vegan": "비건",
      "vegetarian": "채식"
    }
  },
  "detail": {
    "back": "뒤로",
    "directions": "길찾기",
    "share": "공유",
    "shareCopied": "주소가 복사되었습니다",
    "openInKakao": "카카오에서 보기",
    "address": "주소",
    "phone": "전화",
    "gallery": "사진",
    "noPhotos": "사진이 아직 없습니다",
    "reviewsComingSoon": "리뷰와 체크인 기능이 곧 추가됩니다."
  }
}
```

- [ ] **Step 2: Replace `messages/en.json` with:**

```json
{
  "site": {
    "name": "Taco Map",
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
    "resultCountFiltered": "{count, plural, =1 {1 restaurant} other {# restaurants}}",
    "emptyState": "No restaurants match these filters.",
    "curatorBanner": "{count, plural, =1 {Draft mode — 1 restaurant pending review} other {Draft mode — # restaurants pending review}}",
    "curateTitle": "Curate — Draft restaurants",
    "mapUnavailable": "Map unavailable, showing list only.",
    "tabs": {
      "map": "Map",
      "list": "List"
    },
    "filters": {
      "neighborhood": "Neighborhood",
      "dish": "Dish",
      "dietary": "Dietary"
    },
    "dishes": {
      "taco": "Tacos",
      "burrito": "Burritos",
      "quesadilla": "Quesadillas",
      "fajita": "Fajitas",
      "nachos": "Nachos",
      "margarita": "Margaritas",
      "enchilada": "Enchiladas",
      "guacamole": "Guacamole",
      "salsa": "Salsa",
      "tortilla": "Tortillas",
      "chipotle": "Chipotle"
    },
    "dietary": {
      "halal": "Halal",
      "vegan": "Vegan",
      "vegetarian": "Vegetarian"
    }
  },
  "detail": {
    "back": "Back",
    "directions": "Directions",
    "share": "Share",
    "shareCopied": "Link copied",
    "openInKakao": "Open in Kakao",
    "address": "Address",
    "phone": "Phone",
    "gallery": "Photos",
    "noPhotos": "No photos yet",
    "reviewsComingSoon": "Reviews and check-ins are coming soon."
  }
}
```

Note: I removed `resultCountFiltered`'s `{neighborhood}` interpolation — with multi-select neighborhoods, the label would be awkward; the count alone is cleaner.

- [ ] **Step 3: Validate JSON**

```bash
cd taco-tracker
node -e "JSON.parse(require('fs').readFileSync('messages/ko.json', 'utf8')); JSON.parse(require('fs').readFileSync('messages/en.json', 'utf8')); console.log('valid')"
```
Expected: `valid`

- [ ] **Step 4: Verify tests still pass**

```bash
cd taco-tracker && pnpm vitest run
```
Expected: 113/113 pass.

- [ ] **Step 5: Commit**

```bash
git add taco-tracker/messages/ko.json taco-tracker/messages/en.json
git commit -m "feat: add i18n keys for Sprint A filters, dishes, detail page"
```

---

## Task 2 — Data layer (Restaurant type + filter shape + getRestaurantBySlug)

**Files:**
- Modify: `taco-tracker/lib/restaurants.ts`
- Modify: `taco-tracker/tests/restaurants.test.ts`

Adds `photo_candidates`, `enrichment_confidence`, `needs_review`, `review_reason`, `phone`, `instagram` to the `Restaurant` interface and SELECT list (the scraper populated these, but TS doesn't see them yet). Changes `getRestaurants` to accept array filters (`neighborhoods`, `dishes`, `dietary`). Adds `getRestaurantBySlug` for the detail page.

- [ ] **Step 1: Write failing tests for filter construction**

The existing tests only cover `dedupeNeighborhoods`. We add new tests for `buildRestaurantsQuery` (a new pure helper we'll extract). Append to `taco-tracker/tests/restaurants.test.ts`:

```typescript
import { buildRestaurantsQuery, type RestaurantFilters } from '../lib/restaurants'

interface MockQuery {
  eqCalls: Array<[string, unknown]>
  inCalls: Array<[string, unknown[]]>
  overlapsCalls: Array<[string, unknown[]]>
  orCalls: string[]
  orderCalls: Array<[string, { ascending: boolean }]>
  returnsCalls: number
}

function mockQuery() {
  const m: MockQuery = {
    eqCalls: [],
    inCalls: [],
    overlapsCalls: [],
    orCalls: [],
    orderCalls: [],
    returnsCalls: 0,
  }
  const q: any = {
    eq: (col: string, v: unknown) => { m.eqCalls.push([col, v]); return q },
    in: (col: string, v: unknown[]) => { m.inCalls.push([col, v]); return q },
    overlaps: (col: string, v: unknown[]) => { m.overlapsCalls.push([col, v]); return q },
    or: (expr: string) => { m.orCalls.push(expr); return q },
    order: (col: string, opts: { ascending: boolean }) => { m.orderCalls.push([col, opts]); return q },
    returns: () => { m.returnsCalls++; return q },
    select: () => q,
    from: () => q,
    _m: m,
  }
  return q
}

describe('buildRestaurantsQuery', () => {
  it('always filters by status and orders by name_ko ascending', () => {
    const q = mockQuery()
    buildRestaurantsQuery(q, { status: 'live' })
    expect(q._m.eqCalls).toContainEqual(['status', 'live'])
    expect(q._m.orderCalls).toContainEqual(['name_ko', { ascending: true }])
  })

  it('adds .in for neighborhoods array', () => {
    const q = mockQuery()
    buildRestaurantsQuery(q, { status: 'live', neighborhoods: ['용산구', '마포구'] })
    expect(q._m.inCalls).toContainEqual(['neighborhood', ['용산구', '마포구']])
  })

  it('does not add .in when neighborhoods is empty', () => {
    const q = mockQuery()
    buildRestaurantsQuery(q, { status: 'live', neighborhoods: [] })
    expect(q._m.inCalls).toEqual([])
  })

  it('does not add .in when neighborhoods is undefined', () => {
    const q = mockQuery()
    buildRestaurantsQuery(q, { status: 'live' })
    expect(q._m.inCalls).toEqual([])
  })

  it('adds .overlaps for dishes array', () => {
    const q = mockQuery()
    buildRestaurantsQuery(q, { status: 'live', dishes: ['taco', 'burrito'] })
    expect(q._m.overlapsCalls).toContainEqual(['dish_tags', ['taco', 'burrito']])
  })

  it('does not add .overlaps when dishes is empty', () => {
    const q = mockQuery()
    buildRestaurantsQuery(q, { status: 'live', dishes: [] })
    expect(q._m.overlapsCalls).toEqual([])
  })

  it('adds .or with only the selected dietary flags', () => {
    const q = mockQuery()
    buildRestaurantsQuery(q, { status: 'live', dietary: ['vegan', 'halal'] })
    expect(q._m.orCalls).toHaveLength(1)
    expect(q._m.orCalls[0]).toBe('has_vegan_options.eq.true,is_halal.eq.true')
  })

  it('does not add .or when dietary is empty', () => {
    const q = mockQuery()
    buildRestaurantsQuery(q, { status: 'live', dietary: [] })
    expect(q._m.orCalls).toEqual([])
  })

  it('combines all three filter dimensions', () => {
    const q = mockQuery()
    buildRestaurantsQuery(q, {
      status: 'draft',
      neighborhoods: ['용산구'],
      dishes: ['taco'],
      dietary: ['vegetarian'],
    })
    expect(q._m.eqCalls).toContainEqual(['status', 'draft'])
    expect(q._m.inCalls).toContainEqual(['neighborhood', ['용산구']])
    expect(q._m.overlapsCalls).toContainEqual(['dish_tags', ['taco']])
    expect(q._m.orCalls).toContainEqual('has_vegetarian_options.eq.true')
  })
})
```

- [ ] **Step 2: Run tests, expect failure**

```bash
cd taco-tracker && pnpm vitest run tests/restaurants.test.ts
```
Expected: FAIL — `buildRestaurantsQuery` is not exported.

- [ ] **Step 3: Replace `taco-tracker/lib/restaurants.ts` with:**

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

export type RestaurantStatus = 'draft' | 'live' | 'archived'
export type DietaryFlag = 'vegan' | 'vegetarian' | 'halal'
export type EnrichmentConfidence = 'high' | 'medium' | 'low'

export interface Restaurant {
  id: string
  slug: string
  name_ko: string
  name_en: string | null
  neighborhood: string | null
  address_ko: string
  kakao_place_id: string | null
  phone: string | null
  instagram: string | null
  lat: number
  lng: number
  dish_tags: string[]
  has_vegan_options: boolean | null
  has_vegetarian_options: boolean | null
  is_halal: boolean | null
  cover_photo_url: string | null
  photo_candidates: string[]
  curator_rating: number | null
  enrichment_confidence: EnrichmentConfidence | null
  needs_review: boolean
  review_reason: string | null
}

export interface RestaurantFilters {
  status: RestaurantStatus
  neighborhoods?: string[]
  dishes?: string[]
  dietary?: DietaryFlag[]
}

const RESTAURANT_COLUMNS =
  'id, slug, name_ko, name_en, neighborhood, address_ko, kakao_place_id, phone, instagram, lat, lng, ' +
  'dish_tags, has_vegan_options, has_vegetarian_options, is_halal, cover_photo_url, photo_candidates, ' +
  'curator_rating, enrichment_confidence, needs_review, review_reason'

const DIETARY_COLUMN: Record<DietaryFlag, string> = {
  vegan: 'has_vegan_options',
  vegetarian: 'has_vegetarian_options',
  halal: 'is_halal',
}

/**
 * Applies filter clauses to a Supabase query builder. Exported pure helper
 * so the filter construction logic is unit-testable without a live DB.
 *
 * The caller is responsible for the initial `.from('restaurants').select(...)`;
 * this function returns the same builder with filters chained on.
 */
export function buildRestaurantsQuery<Q extends {
  eq: (col: string, v: unknown) => Q
  in: (col: string, v: unknown[]) => Q
  overlaps: (col: string, v: unknown[]) => Q
  or: (expr: string) => Q
  order: (col: string, opts: { ascending: boolean }) => Q
}>(q: Q, filters: RestaurantFilters): Q {
  let query = q.eq('status', filters.status)

  if (filters.neighborhoods && filters.neighborhoods.length > 0) {
    query = query.in('neighborhood', filters.neighborhoods)
  }

  if (filters.dishes && filters.dishes.length > 0) {
    query = query.overlaps('dish_tags', filters.dishes)
  }

  if (filters.dietary && filters.dietary.length > 0) {
    const expr = filters.dietary.map((d) => `${DIETARY_COLUMN[d]}.eq.true`).join(',')
    query = query.or(expr)
  }

  query = query.order('name_ko', { ascending: true })
  return query
}

export async function getRestaurants(
  supabase: SupabaseClient,
  filters: RestaurantFilters
): Promise<Restaurant[]> {
  const base = supabase.from('restaurants').select(RESTAURANT_COLUMNS)
  // The builder methods return a non-final builder; cast through unknown is needed
  // because Supabase's chain types are conditional. The runtime behavior is correct.
  const { data, error } = await (
    buildRestaurantsQuery(base as unknown as Parameters<typeof buildRestaurantsQuery>[0], filters) as ReturnType<typeof base.order>
  ).returns<Restaurant[]>()
  if (error) throw new Error(`Failed to fetch restaurants: ${error.message}`)
  return data ?? []
}

export async function getRestaurantBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<Restaurant | null> {
  const { data, error } = await supabase
    .from('restaurants')
    .select(RESTAURANT_COLUMNS)
    .eq('slug', slug)
    .neq('status', 'archived')
    .maybeSingle()
    .returns<Restaurant | null>()
  if (error) throw new Error(`Failed to fetch restaurant ${slug}: ${error.message}`)
  return data
}

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
    .returns<{ neighborhood: string | null }[]>()

  if (error) throw new Error(`Failed to fetch neighborhoods: ${error.message}`)
  return dedupeNeighborhoods(data ?? [])
}

/**
 * Distinct dish tags present in the data for a given status.
 * Used to derive the set of dish filter chips to show.
 */
export async function getDishTags(
  supabase: SupabaseClient,
  status: RestaurantStatus
): Promise<string[]> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('dish_tags')
    .eq('status', status)
    .returns<{ dish_tags: string[] }[]>()
  if (error) throw new Error(`Failed to fetch dish tags: ${error.message}`)
  const set = new Set<string>()
  for (const row of data ?? []) {
    for (const t of row.dish_tags ?? []) set.add(t)
  }
  return Array.from(set).sort()
}
```

- [ ] **Step 4: Run tests**

```bash
cd taco-tracker && pnpm vitest run tests/restaurants.test.ts
```
Expected: All `buildRestaurantsQuery` tests pass plus the existing `dedupeNeighborhoods` tests (12+ tests).

- [ ] **Step 5: Run full suite**

```bash
cd taco-tracker && pnpm vitest run
```
Expected: existing tests still pass; new tests pass. Some existing call sites of `getRestaurants` may break — they're updated in later tasks.

If full suite fails because callers of `getRestaurants` still pass `{ neighborhood: ... }` instead of `{ neighborhoods: [...] }`, that's expected — the call sites are updated in Tasks 4 and 5. TypeScript errors are OK at this point as long as tests for the data layer itself pass.

- [ ] **Step 6: Commit**

```bash
git add taco-tracker/lib/restaurants.ts taco-tracker/tests/restaurants.test.ts
git commit -m "feat: extend Restaurant type, switch filters to arrays, add getRestaurantBySlug"
```

---

## Task 3 — Filter components (generic + 3 wrappers)

**Files:**
- Create: `taco-tracker/components/filter-chip-row.tsx`
- Replace: `taco-tracker/components/neighborhood-filter.tsx`
- Create: `taco-tracker/components/dish-filter.tsx`
- Create: `taco-tracker/components/dietary-filter.tsx`

A generic multi-select chip row reads/writes a single URL search param (comma-separated). The three wrappers configure it with the right param name, options, and (for dietary) icons.

- [ ] **Step 1: Create `taco-tracker/components/filter-chip-row.tsx`:**

```tsx
import { Link } from '@/i18n/navigation'
import type { ReactNode } from 'react'

export interface ChipOption {
  value: string
  label: string
  icon?: ReactNode
}

interface Props {
  /** Param name in the URL (e.g. "neighborhood", "dish", "dietary"). */
  paramName: string
  /** Current page path (e.g. "/" or "/curate"). */
  basePath: '/' | '/curate'
  /** All other current search params, so we preserve them when this row updates. */
  currentParams: Record<string, string | undefined>
  options: ChipOption[]
  /** Values currently selected in this row. */
  active: string[]
  /** Label for the "clear" chip; if undefined, no clear chip is shown. */
  clearLabel?: string
  /** Optional aria-label for the nav element. */
  ariaLabel: string
}

/**
 * Multi-select chip row. Each chip toggles a value in/out of a comma-separated
 * list URL param. All state lives in the URL; the component is presentational
 * and emits navigations via next-intl Link.
 */
export function FilterChipRow({
  paramName,
  basePath,
  currentParams,
  options,
  active,
  clearLabel,
  ariaLabel,
}: Props) {
  const buildHref = (next: string[]) => {
    const params: Record<string, string> = {}
    for (const [k, v] of Object.entries(currentParams)) {
      if (k !== paramName && v !== undefined && v !== '') params[k] = v
    }
    if (next.length > 0) params[paramName] = next.join(',')
    return Object.keys(params).length === 0
      ? basePath
      : { pathname: basePath, query: params }
  }

  return (
    <nav
      aria-label={ariaLabel}
      className="flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-x-visible sm:pb-0"
    >
      {clearLabel ? (
        <Link href={buildHref([])} className={chipClass(active.length === 0)}>
          {clearLabel}
        </Link>
      ) : null}
      {options.map((opt) => {
        const isActive = active.includes(opt.value)
        const next = isActive
          ? active.filter((v) => v !== opt.value)
          : [...active, opt.value]
        return (
          <Link
            key={opt.value}
            href={buildHref(next)}
            className={chipClass(isActive)}
          >
            {opt.icon ? <span className="mr-1 inline-flex items-center">{opt.icon}</span> : null}
            {opt.label}
          </Link>
        )
      })}
    </nav>
  )
}

function chipClass(isActive: boolean): string {
  const base =
    'inline-flex items-center whitespace-nowrap rounded-full border px-3.5 py-1 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
  return isActive
    ? `${base} border-brand bg-brand text-surface`
    : `${base} border-ink bg-surface text-ink hover:bg-bg`
}
```

- [ ] **Step 2: Replace `taco-tracker/components/neighborhood-filter.tsx` with:**

```tsx
import { getTranslations } from 'next-intl/server'
import { FilterChipRow, type ChipOption } from './filter-chip-row'

interface Props {
  neighborhoods: string[]
  active: string[]
  basePath: '/' | '/curate'
  currentParams: Record<string, string | undefined>
}

export async function NeighborhoodFilter({
  neighborhoods,
  active,
  basePath,
  currentParams,
}: Props) {
  const t = await getTranslations('listing')
  const options: ChipOption[] = neighborhoods.map((n) => ({ value: n, label: n }))
  return (
    <FilterChipRow
      paramName="neighborhood"
      basePath={basePath}
      currentParams={currentParams}
      options={options}
      active={active}
      clearLabel={t('allNeighborhoods')}
      ariaLabel="Neighborhood filter"
    />
  )
}
```

- [ ] **Step 3: Create `taco-tracker/components/dish-filter.tsx`:**

```tsx
import { getTranslations } from 'next-intl/server'
import { FilterChipRow, type ChipOption } from './filter-chip-row'

interface Props {
  dishes: string[]
  active: string[]
  basePath: '/' | '/curate'
  currentParams: Record<string, string | undefined>
}

export async function DishFilter({ dishes, active, basePath, currentParams }: Props) {
  const t = await getTranslations('listing.dishes')
  const options: ChipOption[] = dishes.map((d) => ({
    value: d,
    // If a translation exists, use it; otherwise fall back to the raw tag.
    label: keyExists(d) ? t(d as DishKey) : d,
  }))
  return (
    <FilterChipRow
      paramName="dish"
      basePath={basePath}
      currentParams={currentParams}
      options={options}
      active={active}
      ariaLabel="Dish filter"
    />
  )
}

type DishKey =
  | 'taco' | 'burrito' | 'quesadilla' | 'fajita' | 'nachos' | 'margarita'
  | 'enchilada' | 'guacamole' | 'salsa' | 'tortilla' | 'chipotle'

function keyExists(s: string): s is DishKey {
  return [
    'taco', 'burrito', 'quesadilla', 'fajita', 'nachos', 'margarita',
    'enchilada', 'guacamole', 'salsa', 'tortilla', 'chipotle',
  ].includes(s)
}
```

- [ ] **Step 4: Create `taco-tracker/components/dietary-filter.tsx`:**

```tsx
import { getTranslations } from 'next-intl/server'
import { Leaf, Sprout, Wheat } from 'lucide-react'
import { FilterChipRow, type ChipOption } from './filter-chip-row'

interface Props {
  active: string[]
  basePath: '/' | '/curate'
  currentParams: Record<string, string | undefined>
}

export async function DietaryFilter({ active, basePath, currentParams }: Props) {
  const t = await getTranslations('listing.dietary')
  const options: ChipOption[] = [
    { value: 'vegan', label: t('vegan'), icon: <Leaf className="h-3.5 w-3.5" /> },
    { value: 'vegetarian', label: t('vegetarian'), icon: <Sprout className="h-3.5 w-3.5" /> },
    { value: 'halal', label: t('halal'), icon: <Wheat className="h-3.5 w-3.5" /> },
  ]
  return (
    <FilterChipRow
      paramName="dietary"
      basePath={basePath}
      currentParams={currentParams}
      options={options}
      active={active}
      ariaLabel="Dietary filter"
    />
  )
}
```

(`Wheat` is the closest lucide icon for "halal"; there's no specific halal icon. Acceptable for MVP.)

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd taco-tracker && pnpm tsc --noEmit
```
Expected: no errors related to these new files. There may be errors in `restaurant-list.tsx` because it still passes single `neighborhood` strings — that's fixed in Task 5.

- [ ] **Step 6: Commit**

```bash
git add taco-tracker/components/filter-chip-row.tsx taco-tracker/components/neighborhood-filter.tsx taco-tracker/components/dish-filter.tsx taco-tracker/components/dietary-filter.tsx
git commit -m "feat: generic FilterChipRow + neighborhood/dish/dietary wrappers"
```

---

## Task 4 — Vertical photo-led RestaurantCard

**Files:**
- Modify: `taco-tracker/components/restaurant-card.tsx`

Switch from horizontal layout (photo left, text right) to vertical (photo top, text below). Internal Link to `/restaurant/[slug]` replaces the external Kakao Place link. Drop the address from the card (it moves to the detail page; cards stay clean).

- [ ] **Step 1: Replace `taco-tracker/components/restaurant-card.tsx` with:**

```tsx
'use client'

import { Link } from '@/i18n/navigation'
import { Leaf, Sprout, Wheat } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Restaurant } from '@/lib/restaurants'

interface Props {
  restaurant: Restaurant
  locale: 'ko' | 'en'
}

export function RestaurantCard({ restaurant, locale }: Props) {
  const t = useTranslations('listing.dietary')

  const isKorean = locale === 'ko'
  const primaryName = isKorean
    ? restaurant.name_ko
    : (restaurant.name_en ?? restaurant.name_ko)
  const secondaryName = isKorean
    ? restaurant.name_en
    : (restaurant.name_en ? restaurant.name_ko : null)

  return (
    <Link
      href={`/restaurant/${restaurant.slug}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <article className="overflow-hidden rounded-lg bg-surface shadow-card transition-shadow group-hover:shadow-[0_4px_12px_rgba(27,25,22,0.12)]">
        <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-[#E8DCC8] to-[#D4C4A8]">
          {restaurant.cover_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={restaurant.cover_photo_url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : null}
          {restaurant.curator_rating !== null ? (
            <div className="absolute right-2 top-2 rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-brand shadow-card">
              ★ {restaurant.curator_rating.toFixed(1)}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5 px-3 py-3">
          <div className="min-w-0">
            <div className="truncate text-base font-bold leading-tight text-ink">
              {primaryName}
            </div>
            {secondaryName ? (
              <div className="truncate text-xs text-muted">{secondaryName}</div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {restaurant.neighborhood ? (
              <span className="text-xs text-muted">{restaurant.neighborhood}</span>
            ) : null}
            {restaurant.dish_tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-ink bg-bg px-2 py-0.5 text-[10px] text-ink"
              >
                {tag}
              </span>
            ))}
            {restaurant.is_halal ? (
              <span
                className="inline-flex items-center gap-0.5 rounded-full border border-accent bg-bg px-2 py-0.5 text-[10px] text-accent"
                title={t('halal')}
              >
                <Wheat className="h-3 w-3" /> {t('halal')}
              </span>
            ) : null}
            {restaurant.has_vegan_options ? (
              <span
                className="inline-flex items-center gap-0.5 rounded-full border border-accent bg-bg px-2 py-0.5 text-[10px] text-accent"
                title={t('vegan')}
              >
                <Leaf className="h-3 w-3" /> {t('vegan')}
              </span>
            ) : restaurant.has_vegetarian_options ? (
              <span
                className="inline-flex items-center gap-0.5 rounded-full border border-accent bg-bg px-2 py-0.5 text-[10px] text-accent"
                title={t('vegetarian')}
              >
                <Sprout className="h-3 w-3" /> {t('vegetarian')}
              </span>
            ) : null}
          </div>
        </div>
      </article>
    </Link>
  )
}
```

(`next-intl`'s `Link` accepts a string href and prepends the locale automatically. We don't use typed-routes — too much overhead for a feature this small.)

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd taco-tracker && pnpm tsc --noEmit
```
Expected: no errors from this file. Errors in `MapListView` or `RestaurantList` are expected and resolved in later tasks.

- [ ] **Step 3: Commit**

```bash
git add taco-tracker/components/restaurant-card.tsx
git commit -m "feat: switch RestaurantCard to vertical photo-led layout, link to detail page"
```

---

## Task 5 — RestaurantList wires up 3 filter rows

**Files:**
- Modify: `taco-tracker/components/restaurant-list.tsx`

Reads `neighborhood`, `dish`, `dietary` from search params (comma-split), fetches data with the new array filter shape, renders three filter rows, passes restaurants down to `MapListView`.

- [ ] **Step 1: Replace `taco-tracker/components/restaurant-list.tsx` with:**

```tsx
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getRestaurants,
  getNeighborhoods,
  getDishTags,
  type RestaurantStatus,
  type DietaryFlag,
} from '@/lib/restaurants'
import { getTranslations } from 'next-intl/server'
import { NeighborhoodFilter } from './neighborhood-filter'
import { DishFilter } from './dish-filter'
import { DietaryFilter } from './dietary-filter'
import { MapListView } from './map/map-list-view'

interface Props {
  status: RestaurantStatus
  neighborhood: string | null   // raw search param value (comma-separated)
  dish: string | null
  dietary: string | null
  locale: 'ko' | 'en'
  basePath: '/' | '/curate'
}

const DIETARY_VALUES: DietaryFlag[] = ['vegan', 'vegetarian', 'halal']

function splitCsv(s: string | null): string[] {
  if (!s) return []
  return s.split(',').map((v) => v.trim()).filter((v) => v.length > 0)
}

export async function RestaurantList({
  status,
  neighborhood,
  dish,
  dietary,
  locale,
  basePath,
}: Props) {
  const supabase = status === 'live' ? await createClient() : createAdminClient()

  const neighborhoodValues = splitCsv(neighborhood)
  const dishValues = splitCsv(dish)
  const dietaryValues = splitCsv(dietary).filter((v): v is DietaryFlag =>
    DIETARY_VALUES.includes(v as DietaryFlag)
  )

  const [restaurants, neighborhoods, dishTags] = await Promise.all([
    getRestaurants(supabase, {
      status,
      neighborhoods: neighborhoodValues.length > 0 ? neighborhoodValues : undefined,
      dishes: dishValues.length > 0 ? dishValues : undefined,
      dietary: dietaryValues.length > 0 ? dietaryValues : undefined,
    }),
    getNeighborhoods(supabase, status),
    getDishTags(supabase, status),
  ])

  const t = await getTranslations('listing')
  const count = restaurants.length

  const currentParams: Record<string, string | undefined> = {
    neighborhood: neighborhood ?? undefined,
    dish: dish ?? undefined,
    dietary: dietary ?? undefined,
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted">
          {t('filters.neighborhood')}
        </div>
        <NeighborhoodFilter
          neighborhoods={neighborhoods}
          active={neighborhoodValues}
          basePath={basePath}
          currentParams={currentParams}
        />
      </div>
      {dishTags.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">
            {t('filters.dish')}
          </div>
          <DishFilter
            dishes={dishTags}
            active={dishValues}
            basePath={basePath}
            currentParams={currentParams}
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted">
          {t('filters.dietary')}
        </div>
        <DietaryFilter
          active={dietaryValues}
          basePath={basePath}
          currentParams={currentParams}
        />
      </div>
      <p className="mt-1 text-sm text-muted">
        {neighborhoodValues.length > 0 || dishValues.length > 0 || dietaryValues.length > 0
          ? t('resultCountFiltered', { count })
          : t('resultCountAll', { count })}
      </p>
      <MapListView restaurants={restaurants} locale={locale} />
    </div>
  )
}
```

- [ ] **Step 2: Update `app/[locale]/page.tsx` and `app/[locale]/curate/page.tsx` to read the new search params**

Replace `taco-tracker/app/[locale]/page.tsx`:

```tsx
import { getTranslations } from 'next-intl/server'
import { RestaurantList } from '@/components/restaurant-list'

interface Props {
  params: Promise<{ locale: 'ko' | 'en' }>
  searchParams: Promise<{
    neighborhood?: string
    dish?: string
    dietary?: string
  }>
}

export default async function HomePage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const t = await getTranslations('listing')

  return (
    <main className="mx-auto w-full px-4 py-6 sm:px-6 sm:py-8 2xl:max-w-[1600px]">
      <h1 className="mb-4 font-display text-3xl text-ink sm:text-4xl">
        {t('title')}
      </h1>
      <RestaurantList
        status="live"
        neighborhood={sp.neighborhood ?? null}
        dish={sp.dish ?? null}
        dietary={sp.dietary ?? null}
        locale={locale}
        basePath="/"
      />
    </main>
  )
}
```

Replace `taco-tracker/app/[locale]/curate/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { RestaurantList } from '@/components/restaurant-list'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

interface Props {
  params: Promise<{ locale: 'ko' | 'en' }>
  searchParams: Promise<{
    neighborhood?: string
    dish?: string
    dietary?: string
  }>
}

export default async function CuratePage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const t = await getTranslations('listing')

  const supabase = createAdminClient()
  const { count } = await supabase
    .from('restaurants')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'draft')

  return (
    <main className="mx-auto w-full px-4 py-6 sm:px-6 sm:py-8 2xl:max-w-[1600px]">
      <div className="mb-4 rounded-md border border-brand-deep bg-bg px-4 py-2 text-sm text-brand-deep">
        {t('curatorBanner', { count: count ?? 0 })}
      </div>
      <h1 className="mb-4 font-display text-3xl text-ink sm:text-4xl">
        {t('curateTitle')}
      </h1>
      <RestaurantList
        status="draft"
        neighborhood={sp.neighborhood ?? null}
        dish={sp.dish ?? null}
        dietary={sp.dietary ?? null}
        locale={locale}
        basePath="/curate"
      />
    </main>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd taco-tracker && pnpm tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Run full test suite**

```bash
cd taco-tracker && pnpm vitest run
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add taco-tracker/components/restaurant-list.tsx "taco-tracker/app/[locale]/page.tsx" "taco-tracker/app/[locale]/curate/page.tsx"
git commit -m "feat: render 3 filter rows, read multi-select search params"
```

---

## Task 6 — MapListView desktop proportions

**Files:**
- Modify: `taco-tracker/components/map/map-list-view.tsx`

Vertical cards are wider than the previous horizontal ones, so the list column needs more breathing room than the previous 60/40 split. Move to 65/35 and switch the right column to two-column card grid on wide displays.

Also: pass the full `Restaurant[]` to `KakaoMap` so the next task (popover) can read photo/name/tags from the active row.

- [ ] **Step 1: Replace `taco-tracker/components/map/map-list-view.tsx` with:**

```tsx
'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Restaurant } from '@/lib/restaurants'
import { RestaurantCard } from '../restaurant-card'
import { KakaoMap } from './kakao-map'

interface Props {
  restaurants: Restaurant[]
  locale: 'ko' | 'en'
}

export function MapListView({ restaurants, locale }: Props) {
  const t = useTranslations('listing')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [tab, setTab] = useState<'map' | 'list'>('map')

  const handlePinClick = useCallback((id: string) => {
    setActiveId((prev) => (prev === id ? null : id))
  }, [])

  const handlePopoverClose = useCallback(() => setActiveId(null), [])

  const restaurantById = useMemo(() => {
    const m = new Map<string, Restaurant>()
    for (const r of restaurants) m.set(r.id, r)
    return m
  }, [restaurants])

  if (restaurants.length === 0) {
    return <p className="py-16 text-center text-muted">{t('emptyState')}</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Mobile tabs */}
      <div className="flex gap-1 self-start rounded-full border border-ink bg-surface p-1 md:hidden">
        <button
          type="button"
          onClick={() => setTab('map')}
          className={tabClass(tab === 'map')}
          aria-pressed={tab === 'map'}
        >
          {t('tabs.map')}
        </button>
        <button
          type="button"
          onClick={() => setTab('list')}
          className={tabClass(tab === 'list')}
          aria-pressed={tab === 'list'}
        >
          {t('tabs.list')}
        </button>
      </div>

      {/* Desktop split / mobile single-pane */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[65%_35%]">
        <div className={tab === 'map' ? 'block' : 'hidden md:block'}>
          <div className="h-[60vh] md:sticky md:top-4 md:h-[calc(100vh-8rem)]">
            <KakaoMap
              restaurants={restaurants}
              restaurantById={restaurantById}
              activeId={activeId}
              locale={locale}
              onPinClick={handlePinClick}
              onPopoverClose={handlePopoverClose}
            />
          </div>
        </div>
        <div className={tab === 'list' ? 'block' : 'hidden md:block'}>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
            {restaurants.map((r) => (
              <li key={r.id}>
                <RestaurantCard restaurant={r} locale={locale} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function tabClass(isActive: boolean): string {
  const base =
    'rounded-full px-4 py-1 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
  return isActive ? `${base} bg-brand text-surface` : `${base} text-ink hover:bg-bg`
}
```

Note: I changed `KakaoMap`'s props (added `restaurantById`, `locale`, `onPopoverClose`). TypeScript will error until Task 8 updates `KakaoMap`.

- [ ] **Step 2: Verify TypeScript shows expected errors only in `kakao-map.tsx`**

```bash
cd taco-tracker && pnpm tsc --noEmit
```
Expected: errors localized to `kakao-map.tsx` (it doesn't yet accept the new props). No other regressions.

- [ ] **Step 3: Commit**

```bash
git add taco-tracker/components/map/map-list-view.tsx
git commit -m "feat: MapListView 65/35 split, two-column card grid, pass full data to map"
```

---

## Task 7 — RestaurantPopover component

**Files:**
- Create: `taco-tracker/components/map/restaurant-popover.tsx`

Pure presentation. The next task renders this into a Kakao `CustomOverlay` via portal.

- [ ] **Step 1: Create `taco-tracker/components/map/restaurant-popover.tsx`:**

```tsx
'use client'

import { Link } from '@/i18n/navigation'
import { Leaf, Sprout, Wheat, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Restaurant } from '@/lib/restaurants'

interface Props {
  restaurant: Restaurant
  locale: 'ko' | 'en'
  onClose: () => void
}

export function RestaurantPopover({ restaurant, locale, onClose }: Props) {
  const t = useTranslations('listing.dietary')
  const isKorean = locale === 'ko'
  const primaryName = isKorean
    ? restaurant.name_ko
    : (restaurant.name_en ?? restaurant.name_ko)
  const secondaryName = isKorean
    ? restaurant.name_en
    : (restaurant.name_en ? restaurant.name_ko : null)

  return (
    <div className="w-[220px] overflow-hidden rounded-lg bg-surface shadow-[0_4px_16px_rgba(27,25,22,0.18)]">
      <Link
        href={`/restaurant/${restaurant.slug}`}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-[#E8DCC8] to-[#D4C4A8]">
          {restaurant.cover_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={restaurant.cover_photo_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onClose()
            }}
            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-surface/95 text-ink shadow-card"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="px-3 py-2.5">
          <div className="truncate text-sm font-bold leading-tight text-ink">
            {primaryName}
          </div>
          {secondaryName ? (
            <div className="truncate text-[11px] text-muted">{secondaryName}</div>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {restaurant.neighborhood ? (
              <span className="text-[11px] text-muted">{restaurant.neighborhood}</span>
            ) : null}
            {restaurant.dish_tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-ink bg-bg px-1.5 py-0.5 text-[9px] text-ink"
              >
                {tag}
              </span>
            ))}
            {restaurant.is_halal ? (
              <Wheat className="h-3 w-3 text-accent" aria-label={t('halal')} />
            ) : null}
            {restaurant.has_vegan_options ? (
              <Leaf className="h-3 w-3 text-accent" aria-label={t('vegan')} />
            ) : restaurant.has_vegetarian_options ? (
              <Sprout className="h-3 w-3 text-accent" aria-label={t('vegetarian')} />
            ) : null}
          </div>
        </div>
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd taco-tracker && pnpm tsc --noEmit
```
Expected: no new errors from this file (existing `kakao-map.tsx` errors remain pending Task 8).

- [ ] **Step 3: Commit**

```bash
git add taco-tracker/components/map/restaurant-popover.tsx
git commit -m "feat: RestaurantPopover presentation component"
```

---

## Task 8 — KakaoMap integrates CustomOverlay + portal

**Files:**
- Modify: `taco-tracker/lib/kakao-maps.ts`
- Modify: `taco-tracker/components/map/kakao-map.tsx`

Add `CustomOverlay` to the Kakao type namespace. In `KakaoMap`, when `activeId` changes, create a CustomOverlay anchored at the active marker and render the `RestaurantPopover` into it via `createPortal`. On deselect (or activeId → null) tear it down.

- [ ] **Step 1: Add CustomOverlay types to `taco-tracker/lib/kakao-maps.ts`**

In the `KakaoMapsNamespace` interface, find the line `MarkerClusterer: new ...` and insert below it (still inside the interface):

```typescript
  CustomOverlay: new (options: KakaoCustomOverlayOptions) => KakaoCustomOverlay
```

Then add these two interfaces near the other type exports (after `KakaoClusterer`):

```typescript
export interface KakaoCustomOverlayOptions {
  position: KakaoLatLng
  content: HTMLElement | string
  xAnchor?: number
  yAnchor?: number
  map?: KakaoMap | null
  zIndex?: number
}

export interface KakaoCustomOverlay {
  setMap(map: KakaoMap | null): void
  setPosition(latlng: KakaoLatLng): void
  getPosition(): KakaoLatLng
  setContent(content: HTMLElement | string): void
}
```

- [ ] **Step 2: Replace `taco-tracker/components/map/kakao-map.tsx`**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import {
  loadKakaoMaps,
  type KakaoMapsNamespace,
  type KakaoMap as KakaoMapInstance,
  type KakaoMarker,
  type KakaoClusterer,
  type KakaoCustomOverlay,
} from '@/lib/kakao-maps'
import { pinDataUri } from './pin-icon'
import { RestaurantPopover } from './restaurant-popover'
import type { Restaurant } from '@/lib/restaurants'

interface Props {
  restaurants: Restaurant[]
  restaurantById: Map<string, Restaurant>
  activeId: string | null
  locale: 'ko' | 'en'
  onPinClick: (id: string) => void
  onPopoverClose: () => void
}

const SEOUL_CENTER = { lat: 37.5665, lng: 126.978 }
const SEOUL_LEVEL = 8

export function KakaoMap({
  restaurants,
  restaurantById,
  activeId,
  locale,
  onPinClick,
  onPopoverClose,
}: Props) {
  const t = useTranslations('listing')
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<KakaoMapInstance | null>(null)
  const namespaceRef = useRef<KakaoMapsNamespace | null>(null)
  const markersRef = useRef<Map<string, KakaoMarker>>(new Map())
  const clustererRef = useRef<KakaoClusterer | null>(null)
  const overlayRef = useRef<KakaoCustomOverlay | null>(null)

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [showLoading, setShowLoading] = useState(false)
  const [overlayContainer, setOverlayContainer] = useState<HTMLElement | null>(null)

  // Delay loading indicator to avoid flash
  useEffect(() => {
    if (status !== 'loading') return
    const timer = setTimeout(() => setShowLoading(true), 500)
    return () => clearTimeout(timer)
  }, [status])

  // Load SDK and create the map once
  useEffect(() => {
    let cancelled = false
    loadKakaoMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return
        namespaceRef.current = maps
        mapRef.current = new maps.Map(containerRef.current, {
          center: new maps.LatLng(SEOUL_CENTER.lat, SEOUL_CENTER.lng),
          level: SEOUL_LEVEL,
        })
        clustererRef.current = new maps.MarkerClusterer({
          map: mapRef.current,
          averageCenter: true,
          minLevel: 5,
          styles: [
            {
              width: '40px',
              height: '40px',
              background: '#C84B2F',
              color: '#FFFBF2',
              borderRadius: '20px',
              textAlign: 'center',
              lineHeight: '40px',
              fontWeight: '700',
              fontSize: '14px',
            },
          ],
        })
        setStatus('ready')
      })
      .catch((err) => {
        console.error('Kakao Maps load failed:', err)
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Sync markers with restaurants prop
  useEffect(() => {
    if (status !== 'ready') return
    const maps = namespaceRef.current
    const map = mapRef.current
    const clusterer = clustererRef.current
    if (!maps || !map || !clusterer) return

    clusterer.clear()
    markersRef.current.clear()

    const defaultImage = new maps.MarkerImage(
      pinDataUri({ active: false }),
      new maps.Size(32, 32),
      { offset: new maps.Point(16, 30) }
    )
    const newMarkers: KakaoMarker[] = []
    for (const r of restaurants) {
      const position = new maps.LatLng(r.lat, r.lng)
      const marker = new maps.Marker({ position, image: defaultImage })
      maps.event.addListener(marker, 'click', () => onPinClick(r.id))
      markersRef.current.set(r.id, marker)
      newMarkers.push(marker)
    }
    clusterer.addMarkers(newMarkers)

    if (newMarkers.length > 0) {
      const bounds = new maps.LatLngBounds()
      for (const m of newMarkers) bounds.extend(m.getPosition())
      if (!bounds.isEmpty()) map.setBounds(bounds, 40, 40, 40, 40)
    } else {
      map.setCenter(new maps.LatLng(SEOUL_CENTER.lat, SEOUL_CENTER.lng))
      map.setLevel(SEOUL_LEVEL)
    }
  }, [restaurants, status, onPinClick])

  // Sync active marker styling
  useEffect(() => {
    if (status !== 'ready') return
    const maps = namespaceRef.current
    if (!maps) return

    const defaultImage = new maps.MarkerImage(
      pinDataUri({ active: false }),
      new maps.Size(32, 32),
      { offset: new maps.Point(16, 30) }
    )
    const activeImage = new maps.MarkerImage(
      pinDataUri({ active: true }),
      new maps.Size(40, 40),
      { offset: new maps.Point(20, 38) }
    )

    for (const [id, marker] of markersRef.current.entries()) {
      marker.setImage(id === activeId ? activeImage : defaultImage)
    }
  }, [activeId, status])

  // Manage popover CustomOverlay lifecycle
  useEffect(() => {
    if (status !== 'ready') return
    const maps = namespaceRef.current
    const map = mapRef.current
    if (!maps || !map) return

    // Tear down previous overlay (if any)
    if (overlayRef.current) {
      overlayRef.current.setMap(null)
      overlayRef.current = null
    }
    setOverlayContainer(null)

    if (activeId === null) return
    const marker = markersRef.current.get(activeId)
    if (!marker) return

    const container = document.createElement('div')
    // The popover renders into this; xAnchor=0.5 centers, yAnchor=1.1 lifts it above the pin tip.
    const overlay = new maps.CustomOverlay({
      position: marker.getPosition(),
      content: container,
      xAnchor: 0.5,
      yAnchor: 1.1,
      zIndex: 5,
      map,
    })
    overlayRef.current = overlay
    setOverlayContainer(container)

    return () => {
      overlay.setMap(null)
      if (overlayRef.current === overlay) overlayRef.current = null
    }
  }, [activeId, status])

  const activeRestaurant = activeId !== null ? restaurantById.get(activeId) ?? null : null

  if (status === 'error') {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-md border border-muted bg-bg p-4 text-sm text-muted">
        {t('mapUnavailable')}
      </div>
    )
  }

  return (
    <div className="relative h-full min-h-[400px] w-full overflow-hidden rounded-md bg-bg">
      <div ref={containerRef} className="h-full w-full" />
      {status === 'loading' && showLoading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-bg/80 text-sm text-muted">
          Loading map…
        </div>
      ) : null}
      {overlayContainer && activeRestaurant
        ? createPortal(
            <RestaurantPopover
              restaurant={activeRestaurant}
              locale={locale}
              onClose={onPopoverClose}
            />,
            overlayContainer
          )
        : null}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd taco-tracker && pnpm tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Run full test suite**

```bash
cd taco-tracker && pnpm vitest run
```
Expected: all tests pass.

- [ ] **Step 5: Smoke-test the dev server**

```bash
cd taco-tracker && pnpm dev
```

Open `http://localhost:3000/curate`:
- 3 filter rows visible above the map+list (Neighborhood / Dish / Dietary)
- Cards in vertical photo-led layout
- Click a pin → popover appears above it with photo + name
- Click another pin → popover switches
- Click "×" → popover dismisses
- Click popover body → navigates to `/restaurant/[slug]` (currently 404 — fixed in Task 10)
- Click a 구 chip → list + map filter
- Click multiple dish chips → OR within row
- Click a card → navigates to `/restaurant/[slug]` (currently 404)

Stop with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add taco-tracker/lib/kakao-maps.ts taco-tracker/components/map/kakao-map.tsx
git commit -m "feat: anchored pin popover via CustomOverlay + React portal"
```

---

## Task 9 — PhotoGallery with native lightbox

**Files:**
- Create: `taco-tracker/components/photo-gallery.tsx`

Thumbnails of `photo_candidates`. Click a thumbnail to open the full image in a native `<dialog>` element. No JS library — `dialog.showModal()` + ESC/backdrop click for dismissal.

- [ ] **Step 1: Create `taco-tracker/components/photo-gallery.tsx`:**

```tsx
'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'

interface Props {
  photos: string[]
}

export function PhotoGallery({ photos }: Props) {
  const t = useTranslations('detail')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [active, setActive] = useState<string | null>(null)

  if (photos.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">{t('noPhotos')}</p>
  }

  const open = (src: string) => {
    setActive(src)
    dialogRef.current?.showModal()
  }
  const close = () => {
    dialogRef.current?.close()
    setActive(null)
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((src) => (
          <li key={src}>
            <button
              type="button"
              onClick={() => open(src)}
              className="block aspect-square w-full overflow-hidden rounded-md bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="h-full w-full object-cover transition-transform hover:scale-105"
                loading="lazy"
              />
            </button>
          </li>
        ))}
      </ul>
      <dialog
        ref={dialogRef}
        onClick={(e) => {
          // Close when clicking the backdrop (target === dialog itself).
          if (e.target === dialogRef.current) close()
        }}
        onCancel={(e) => {
          e.preventDefault()
          close()
        }}
        className="m-auto max-h-[90vh] max-w-[90vw] rounded-lg bg-surface p-0 backdrop:bg-black/70"
      >
        {active ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={active} alt="" className="max-h-[90vh] max-w-[90vw] object-contain" />
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-surface/95 text-ink shadow-card"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : null}
      </dialog>
    </>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd taco-tracker && pnpm tsc --noEmit
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add taco-tracker/components/photo-gallery.tsx
git commit -m "feat: PhotoGallery with native dialog lightbox"
```

---

## Task 10 — Restaurant detail page

**Files:**
- Create: `taco-tracker/components/restaurant-detail.tsx`
- Create: `taco-tracker/app/[locale]/restaurant/[slug]/page.tsx`

Stub detail page: hero photo, title + meta, three action buttons (Directions / Share / Open in Kakao), address+phone, photo gallery, "reviews coming soon" placeholder.

- [ ] **Step 1: Create `taco-tracker/components/restaurant-detail.tsx`:**

```tsx
'use client'

import { Link } from '@/i18n/navigation'
import { ArrowLeft, MapPin, Phone, Share2, Navigation, ExternalLink, Leaf, Sprout, Wheat } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { Restaurant } from '@/lib/restaurants'
import { PhotoGallery } from './photo-gallery'

interface Props {
  restaurant: Restaurant
  locale: 'ko' | 'en'
}

export function RestaurantDetail({ restaurant, locale }: Props) {
  const t = useTranslations('detail')
  const tDietary = useTranslations('listing.dietary')
  const [shareNotice, setShareNotice] = useState(false)

  const isKorean = locale === 'ko'
  const primaryName = isKorean
    ? restaurant.name_ko
    : (restaurant.name_en ?? restaurant.name_ko)
  const secondaryName = isKorean
    ? restaurant.name_en
    : (restaurant.name_en ? restaurant.name_ko : null)

  const kakaoUrl = restaurant.kakao_place_id
    ? `https://place.map.kakao.com/${restaurant.kakao_place_id}`
    : null
  const directionsUrl = `https://map.kakao.com/?eName=${encodeURIComponent(restaurant.name_ko)}&eLat=${restaurant.lat}&eLng=${restaurant.lng}`

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const title = primaryName
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        // user dismissed or share failed — fall through to clipboard
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url)
        setShareNotice(true)
        setTimeout(() => setShareNotice(false), 2000)
      } catch {
        /* ignore */
      }
    }
  }

  const galleryPhotos = restaurant.photo_candidates.length > 0
    ? restaurant.photo_candidates
    : (restaurant.cover_photo_url ? [restaurant.cover_photo_url] : [])

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6 sm:py-6">
      <Link href="/" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {t('back')}
      </Link>

      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-gradient-to-br from-[#E8DCC8] to-[#D4C4A8]">
        {restaurant.cover_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={restaurant.cover_photo_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>

      <h1 className="mt-4 font-display text-3xl text-ink sm:text-4xl">{primaryName}</h1>
      {secondaryName ? (
        <p className="mt-1 text-sm text-muted">{secondaryName}</p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {restaurant.neighborhood ? (
          <span className="text-sm text-muted">{restaurant.neighborhood}</span>
        ) : null}
        {restaurant.dish_tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-ink bg-bg px-2.5 py-0.5 text-xs text-ink"
          >
            {tag}
          </span>
        ))}
        {restaurant.is_halal ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-accent bg-bg px-2.5 py-0.5 text-xs text-accent">
            <Wheat className="h-3 w-3" /> {tDietary('halal')}
          </span>
        ) : null}
        {restaurant.has_vegan_options ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-accent bg-bg px-2.5 py-0.5 text-xs text-accent">
            <Leaf className="h-3 w-3" /> {tDietary('vegan')}
          </span>
        ) : restaurant.has_vegetarian_options ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-accent bg-bg px-2.5 py-0.5 text-xs text-accent">
            <Sprout className="h-3 w-3" /> {tDietary('vegetarian')}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-ink bg-surface px-4 py-1.5 text-sm font-medium text-ink hover:bg-bg"
        >
          <Navigation className="h-4 w-4" /> {t('directions')}
        </a>
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink bg-surface px-4 py-1.5 text-sm font-medium text-ink hover:bg-bg"
        >
          <Share2 className="h-4 w-4" /> {t('share')}
        </button>
        {kakaoUrl ? (
          <a
            href={kakaoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-ink bg-surface px-4 py-1.5 text-sm font-medium text-ink hover:bg-bg"
          >
            <ExternalLink className="h-4 w-4" /> {t('openInKakao')}
          </a>
        ) : null}
        {shareNotice ? (
          <span className="self-center text-xs text-muted">{t('shareCopied')}</span>
        ) : null}
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">
            {t('address')}
          </dt>
          <dd className="mt-1 flex items-start gap-1 text-sm text-ink">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <span>{restaurant.address_ko}</span>
          </dd>
        </div>
        {restaurant.phone ? (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">
              {t('phone')}
            </dt>
            <dd className="mt-1 flex items-start gap-1 text-sm text-ink">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
              <a href={`tel:${restaurant.phone}`} className="hover:underline">
                {restaurant.phone}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-xl text-ink">{t('gallery')}</h2>
        <PhotoGallery photos={galleryPhotos} />
      </section>

      <section className="mt-8 rounded-lg border border-muted bg-bg px-4 py-6 text-center">
        <p className="text-sm text-muted">{t('reviewsComingSoon')}</p>
      </section>
    </article>
  )
}
```

- [ ] **Step 2: Create `taco-tracker/app/[locale]/restaurant/[slug]/page.tsx`:**

```tsx
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRestaurantBySlug } from '@/lib/restaurants'
import { RestaurantDetail } from '@/components/restaurant-detail'

interface Props {
  params: Promise<{ locale: 'ko' | 'en'; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params
  const supabase = await createClient()
  let restaurant = await getRestaurantBySlug(supabase, slug)
  // Fall back to admin client for draft rows (curator preview).
  if (!restaurant) {
    restaurant = await getRestaurantBySlug(createAdminClient(), slug)
    if (restaurant) {
      // Draft: don't index.
      return {
        title: restaurant.name_ko,
        robots: { index: false, follow: false },
      }
    }
  }
  if (!restaurant) return { title: 'Taco Map' }
  const name =
    locale === 'en' ? (restaurant.name_en ?? restaurant.name_ko) : restaurant.name_ko
  return {
    title: `${name} · Taco Map`,
    description: restaurant.address_ko,
  }
}

export default async function RestaurantPage({ params }: Props) {
  const { slug, locale } = await params
  const supabase = await createClient()
  let restaurant = await getRestaurantBySlug(supabase, slug)
  if (!restaurant) {
    // Try admin (draft / curator preview)
    restaurant = await getRestaurantBySlug(createAdminClient(), slug)
  }
  if (!restaurant) notFound()
  return <RestaurantDetail restaurant={restaurant} locale={locale} />
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd taco-tracker && pnpm tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Run full test suite**

```bash
cd taco-tracker && pnpm vitest run
```
Expected: all tests pass.

- [ ] **Step 5: Smoke-test the dev server**

```bash
cd taco-tracker && pnpm dev
```

Open in a browser:
- `http://localhost:3000/curate` — vertical cards, 3 filter rows, photos visible
- Click any card → navigates to `/en/restaurant/[slug]` (or `/restaurant/[slug]` in KO)
- Detail page renders: hero photo, name, dish/dietary chips, action buttons, address, photo gallery
- Click a gallery thumbnail → lightbox opens; click backdrop or "×" or ESC → closes
- Click "Directions" → opens Kakao Map in new tab
- Click "Share" → native share sheet (mobile) or "Link copied" notice + clipboard (desktop)
- Click "Open in Kakao" → opens Kakao Place
- Click "Back" → returns to listing
- `http://localhost:3000/curate` → click a pin → popover appears → click popover body → navigates to detail page
- Resize narrow (<768px) → mobile tabs (Map / List); filter rows scroll horizontally; cards become single column

Stop with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add taco-tracker/components/restaurant-detail.tsx "taco-tracker/app/[locale]/restaurant/[slug]/page.tsx"
git commit -m "feat: stub restaurant detail page at /restaurant/[slug]"
```

---

## Verification

After all tasks complete:

**1. Tests:**
```bash
cd taco-tracker && pnpm vitest run
```
Expected: all tests pass (~125 — 113 existing + ~12 new for `buildRestaurantsQuery`).

**2. TypeScript check:**
```bash
cd taco-tracker && pnpm tsc --noEmit
```
Expected: clean.

**3. End-to-end manual verification:**
```bash
cd taco-tracker && pnpm dev
```

Check all of:
- Vertical photo-led cards on `/` and `/curate`
- Three filter rows visible above map+list
- Multi-select within a row works (click 2 dishes → both highlighted)
- Cross-row filtering (e.g., 용산구 + taco + vegan) — list and map both update
- Pin click → anchored popover above pin
- Popover click → detail page
- Popover "×" or another pin → dismisses
- Card click → detail page
- Detail page hero, action buttons, gallery lightbox all work
- Mobile (resize narrow): tab bar, horizontal-scrolling filter rows, single-column cards
- `/en/restaurant/[slug]` shows English name primary
- View page source on `/curate/restaurant/[slug]` — confirm robots noindex still applied (via the metadata branch for drafts)

---

## Deferred from spec / explicitly out of scope (Sprint B+)

- Rating display in popover/cards (no `curator_rating` data populated)
- "Highest Rated" / "Most Reviews" sort tabs (no rating data)
- Add Review / Check-in / Heart / Photo upload (needs auth + new tables)
- "Follow" / "Save" / "Report" buttons (needs auth)
- Real reviews on detail page (placeholder shown instead)
- React component tests (project still lacks RTL infrastructure)
