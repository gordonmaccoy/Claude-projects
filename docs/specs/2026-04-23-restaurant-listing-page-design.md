# Restaurant Listing Page — Design Spec

_Date: 2026-04-23_

## Goal

Add the first real product surface to Taco Tracker Korea: a server-rendered listing page that shows restaurants from Supabase, filterable by neighborhood, in both Korean and English. Establishes the data-fetching pattern and component vocabulary that the map view and detail pages will reuse.

## Context

After Parts 1 & 2 of the MVP, the database holds 108 draft restaurants seeded from Kakao and enriched with `name_en`, `dish_tags`, and dietary flags. There is no UI to view them yet — the home page is a placeholder heading. This spec covers a listing page (Layout B from brainstorming: horizontal rows).

## Routes

| Route | Locale | Filter | Audience |
|---|---|---|---|
| `/` | Korean | `status='live'` | Public |
| `/en` | English | `status='live'` | Public |
| `/curate` | Korean | `status='draft'` | Curator (no auth — secret URL) |
| `/en/curate` | English | `status='draft'` | Curator |

Both pairs share the same React components — only the Supabase query differs. The `/curate` pages show a muted banner ("Draft mode — N restaurants pending review") so the curator knows which page they are on. The curator pages also set `robots: { index: false, follow: false }` in their metadata so they don't appear in search engine results.

## Page Hierarchy

1. **Header** — site name + locale toggle (reuses existing layout chrome)
2. **Page title** — i18n heading
3. **Curator banner** — only on `/curate`
4. **Neighborhood filter chip row** — `전체` (All) plus each unique `neighborhood` value, alphabetical. Wraps on desktop, horizontal scroll on mobile
5. **Result count** — small muted text below filter, e.g. "12 restaurants in 용산구"
6. **List of restaurant cards** — horizontal rows, alphabetical by `name_ko`
7. **Empty state** when zero results — "No restaurants match these filters."

## Card Design (Layout B — horizontal row)

```
┌──────────────┬─────────────────────────────────────────────┐
│              │  바토스 이태원점              ★ 4.5         │
│   [photo]    │  Vatos Urban Tacos                          │
│   120 × 80   │  용산구  • [taco]                            │
│   3:2 ratio  │  서울 용산구 이태원로 205                   │
└──────────────┴─────────────────────────────────────────────┘
```

- **Photo** — 120×80 on the left (3:2). Terracotta-tinted gradient fallback when `cover_photo_url` is null. Shrinks to 80×60 below 480px viewport
- **Name** — `name_ko` bold, `name_en` muted line below (omit EN line when null). On English route, `name_en` is primary if present, with `name_ko` muted below
- **Rating** — top-right when `curator_rating` set, omitted otherwise
- **Meta row** — neighborhood (muted) + dish tag chips + dietary flag icons (halal/vegan/vegetarian when set)
- **Address** — `address_ko`, muted, one line with ellipsis on mobile
- **Whole card is `<a href="https://place.map.kakao.com/{kakao_place_id}" target="_blank" rel="noopener">`** — opens Kakao Place externally

Visual tokens from `docs/design-rules.md`:
- Card surface `--color-surface` (`#FFFBF2`) with shadow `0 2px 8px rgba(27, 25, 22, 0.08)`
- 8px corner radius
- Hover: subtle deepening of shadow, no transform

## Filter Behavior

- Filter state lives in **URL search params** (`?neighborhood=용산구`), not React state
- Each chip is a `next-intl` `Link` that updates the param; "전체" clears it
- Active chip: terracotta fill, cream text. Inactive: cream fill, ink outline, ink text
- Server-side rendering — works without client JavaScript
- Neighborhood list derived from `SELECT DISTINCT neighborhood FROM restaurants WHERE status=$STATUS AND neighborhood IS NOT NULL ORDER BY neighborhood`

## i18n

- Page chrome translated via `next-intl` message catalog (`messages/ko.json`, `messages/en.json`):
  - `listing.title`, `listing.subtitle`, `listing.allNeighborhoods`, `listing.resultCount`, `listing.emptyState`, `listing.curatorBanner`
- Restaurant `name_ko` always shown (it's the canonical name)
- `name_en` shown when present; primary on English route, secondary on Korean route
- Neighborhoods stay Korean (`용산구`) — they read the same to both audiences
- Address stays Korean (`address_ko`)

## Component File Structure

| Path | Responsibility |
|---|---|
| `lib/restaurants.ts` | Data layer: `getRestaurants({ status, neighborhood })` and `getNeighborhoods(status)` |
| `components/restaurant-card.tsx` | Single horizontal row card (server component) |
| `components/neighborhood-filter.tsx` | Chip row, server component, renders `Link`s |
| `components/restaurant-list.tsx` | Wrapper: renders filter + count + list of cards |
| `app/[locale]/page.tsx` | Modify: render `<RestaurantList status="live" />` |
| `app/[locale]/curate/page.tsx` | New: render curator banner + `<RestaurantList status="draft" />` |
| `messages/ko.json`, `messages/en.json` | Add `listing.*` keys |

All components are **server components** — no client-side state, no `'use client'`. The locale-aware `<Link>` from `i18n/routing` handles navigation.

## Sort

Alphabetical by `name_ko` (Postgres `ORDER BY name_ko ASC`). Sortable later as a separate enhancement.

## Empty State

- Filter returns 0 rows → "No restaurants match these filters." centered, muted
- `status='live'` returns 0 rows on `/` → same message (until curator publishes first row)

## Out of Scope (Defer)

- Search box (text matching on name)
- Multi-select / combined filters (dish tag + neighborhood)
- Map view
- Restaurant detail pages
- Photo upload / curation UI
- Authentication on `/curate`
- Editing rows from the listing

## Testing

- Unit tests for the data layer (`lib/restaurants.ts`) — query construction
- Component tests for `<RestaurantCard>` — renders name, handles null `name_en`, null rating, etc.
- Integration test: server-render `/` and `/curate` with mocked Supabase, assert correct status filter
- Manual verification: load `/`, load `/curate`, click a neighborhood chip, click a card (opens Kakao)
