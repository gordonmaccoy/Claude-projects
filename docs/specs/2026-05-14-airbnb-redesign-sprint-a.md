# Airbnb-Style Redesign — Sprint A — Design Spec

_Date: 2026-05-14_

## Goal

Transform the Taco Map listing pages from compact text-led horizontal rows into photo-led vertical cards with rich filtering and an anchored pin popover — matching the user's "Guinness Map / Airbnb" reference. Add a stub restaurant detail page so navigation is in place. **Sprint A is the UI shift only**; Sprint B (auth + user reviews) is deliberately deferred and stubbed.

## Context

After the Playwright scraper (2026-05-14), all 84 live restaurants now have:
- `cover_photo_url` populated
- Up to 8 photos in `photo_candidates`
- `dish_tags` populated from real menu/category text
- Dietary flags where evidence exists

The current cards are still text-led horizontal rows from the listing-page sprint, designed for an era when no photos existed. They look bare next to the new data. The user has asked for an Airbnb-style redesign in line with the [Guinness Map](https://www.theguinnessmap.com/) — photo-led cards, anchored pin popovers, rich filter icons.

This spec covers Sprint A (UI shift, no new infra). A separate spec will cover Sprint B (auth, user reviews, photo uploads, hearts, check-ins).

## Routes

No new top-level routes. New nested route:

| Route | Locale | Purpose |
|---|---|---|
| `/` and `/en` | KO/EN | Map + list (existing, redesigned cards + popover) |
| `/curate` and `/en/curate` | KO/EN | Same UI, drafts only (existing) |
| `/restaurant/[slug]` and `/en/restaurant/[slug]` | KO/EN | **NEW** — stub detail page |

## Card layout (vertical, photo-led)

- **Photo** on top, full card width, `4:3` aspect
- **Below photo:**
  - Top row: `name_ko` (bold) on the left, rating slot on the right (hidden when `curator_rating` is null — Sprint C populates this)
  - Secondary row: neighborhood (small, muted) · `name_en` (when present)
  - Tag row: dish tag chips + dietary icons inline
- **No address shown on card** (it's on the detail page; cards stay clean)
- **Card click** → navigates to `/restaurant/[slug]` (was: opened Kakao Place externally)
- Hover state (desktop only): subtle shadow lift
- No "active state coupled to pin selection" — the popover IS the spatial signal that a pin is selected. Map and list state are decoupled. This is a deliberate departure from the previous design.

## Filter chip rows

Three independent rows above the map+list area. Each is a horizontal scrollable strip on mobile, wraps on desktop.

| Row | Source of options | Style |
|---|---|---|
| **Neighborhood** | `getNeighborhoods()` — distinct values from current data | text-only chip (becomes multi-select; "All" clears) |
| **Dish** | derived from union of all `dish_tags` actually present in the data | text chip with subtle utensil icon |
| **Dietary** | three fixed chips: vegan / vegetarian / halal | icon (lucide `Leaf`, `Sprout`, custom for halal) + label |

**Logic:**
- Multiple selections within one row = **OR** (e.g. dishes "taco OR burrito")
- Across rows = **AND** (e.g. (taco OR burrito) AND vegetarian AND 용산구)

**URL state:**
- `?neighborhood=용산구,마포구&dish=taco,burrito&dietary=vegetarian`
- Comma-separated for multi-select (matches existing `?neighborhood=` pattern, extended to lists for all three keys)

**Active state per chip:** terracotta fill, cream text. Inactive: cream fill, ink outline.

## Pin popover (anchored)

When a pin is clicked, a small floating card appears anchored above the pin. Click another pin to switch; click "×" or anywhere outside to dismiss.

**Content:**
- Cover photo (small, 4:3, ~200px wide)
- `name_ko` (primary) + `name_en` (muted secondary, omitted if null)
- Neighborhood (small muted text)
- Dish tag chips (max 3 visible, "+N" if more)
- Dietary icons inline (when set)
- Rating slot (hidden when null)
- Whole popover body is a link → `/restaurant/[slug]`
- "×" close button in the top-right of the photo

**Implementation:**
- Use Kakao's native `CustomOverlay` API — auto-tracks pan/zoom, no manual position math
- Render the React popover into the overlay's div via `createPortal`
- The overlay's `xAnchor: 0.5, yAnchor: 1.0 + offset` so the bottom-center of the popover sits above the pin

**Interaction nuances:**
- Pan/zoom keeps the popover anchored to the pin
- Map click outside any pin dismisses
- Edge clipping: rely on Kakao's overlay positioning (it handles edge cases adequately for MVP)

## Detail page stub at `/restaurant/[slug]`

Server-rendered, SEO-friendly. Reuses the locale layout.

**Hierarchy:**
1. **Back link** (top-left) — uses `next-intl` Link to `/` (or `/curate` if referrer is curate; ship simple version: always back to home)
2. **Hero photo** — full-width below the back link, `cover_photo_url`. 16:9 on desktop, 4:3 on mobile.
3. **Title block:** `name_ko` (large), `name_en` (muted below), neighborhood + dish chips inline
4. **Action buttons** (horizontal row):
   - **Directions** — opens `https://map.kakao.com/?sName=현재위치&eName={place_name}` (Kakao Map deeplink) in new tab
   - **Share** — Web Share API where available, fallback to copy URL to clipboard
   - **Open in Kakao** — the existing `https://place.map.kakao.com/{kakao_place_id}` link
5. **Meta panel** — address (clickable to copy), phone (`tel:` link), dish tags, dietary icons
6. **Photo gallery** — thumbnails of `photo_candidates` (up to 8). Click → lightbox (use `<dialog>` element, native, no library)
7. **Reviews placeholder** — muted card: "Reviews and check-ins are coming soon."

**Data fetch:**
- New `getRestaurantBySlug(supabase, slug)` in `lib/restaurants.ts`
- Service-role client used for draft slugs (when accessed from `/curate` flow); anon for live
- 404 via `notFound()` from Next.js when slug not found or row is `archived`

## Component changes

| File | Action | Why |
|---|---|---|
| `lib/restaurants.ts` | Modify | Add `photo_candidates`, `enrichment_confidence`, `needs_review`, `review_reason` to interface + SELECT. Add `getRestaurantBySlug(supabase, slug)`. Update `getRestaurants` filter shape to `{ status, neighborhood?, dishes?, dietary? }` |
| `components/restaurant-card.tsx` | Modify | Vertical layout (photo on top), internal Link to detail page, drop external Kakao link, drop address |
| `components/neighborhood-filter.tsx` | Replace | Becomes `components/filter-chip-row.tsx` — generic, reusable for any single-key filter |
| `components/dish-filter.tsx` | Create | Wraps `FilterChipRow` for dish tags; multi-select |
| `components/dietary-filter.tsx` | Create | Wraps `FilterChipRow` for dietary flags; multi-select; uses lucide icons |
| `components/restaurant-list.tsx` | Modify | Render 3 filter rows; pass merged filter object down; update result count |
| `components/map/map-list-view.tsx` | Modify | Desktop layout: map 65% / vertical-card list 35%; mobile tabs unchanged |
| `components/map/kakao-map.tsx` | Modify | Add `CustomOverlay` for popover when `activeId !== null`; portal React content into overlay div |
| `components/map/restaurant-popover.tsx` | Create | Popover content (photo + name + tags); rendered into Kakao overlay via portal |
| `app/[locale]/restaurant/[slug]/page.tsx` | Create | Stub detail page (server component) |
| `components/restaurant-detail.tsx` | Create | Detail page body — hero + meta + actions + gallery + placeholder |
| `components/photo-gallery.tsx` | Create | Thumbnail grid with `<dialog>` lightbox |
| `messages/ko.json`, `messages/en.json` | Modify | Add keys for filter labels (dish/dietary/halal/etc.), detail page actions (Directions/Share/Back), placeholder text |

## i18n keys to add (under `listing` and new `detail` namespaces)

- `listing.filters.dish` — "Dish" / "메뉴"
- `listing.filters.dietary` — "Dietary" / "식이"
- `listing.dietary.vegan` (existing), `vegetarian` (existing), `halal` (existing)
- `listing.dishes.taco`, `dishes.burrito`, `dishes.quesadilla`, `dishes.fajita`, `dishes.nachos`, `dishes.margarita`, `dishes.enchilada`, `dishes.guacamole`, `dishes.salsa`, `dishes.tortilla`, `dishes.chipotle` — dish chip labels (English: "Tacos", "Burritos"; Korean: "타코", "부리또" etc. — reuse the user-facing forms)
- `detail.back` — "Back" / "뒤로"
- `detail.directions` — "Directions" / "길찾기"
- `detail.share` — "Share" / "공유"
- `detail.openInKakao` — "Open in Kakao" / "카카오에서 보기"
- `detail.address` — "Address" / "주소"
- `detail.phone` — "Phone" / "전화"
- `detail.gallery` — "Photos" / "사진"
- `detail.reviewsComingSoon` — "Reviews and check-ins are coming soon." / "리뷰와 체크인 기능이 곧 추가됩니다."

## Filter logic — pure function

A new pure helper in `lib/restaurants.ts`:

```typescript
export interface RestaurantFilters {
  status: RestaurantStatus
  neighborhoods?: string[]   // OR within array; undefined or empty = no filter
  dishes?: string[]          // OR within array
  dietary?: Array<'vegan' | 'vegetarian' | 'halal'>  // OR within array
}
```

Server query construction (Supabase JS):
- `neighborhoods` → `.in('neighborhood', neighborhoods)` (Postgres `IN` clause)
- `dishes` → `.overlaps('dish_tags', dishes)` (Postgres array overlap — matches if any tag in `dishes` is present in row's `dish_tags`)
- `dietary` → build an OR clause of only the selected flags. For example, `dietary=['vegan','halal']` becomes `.or('has_vegan_options.eq.true,is_halal.eq.true')`. If `dietary` is empty or undefined, no clause added. The OR is **within** the dietary row (consistent with within-row OR semantics).
- Empty/undefined arrays must not add any filter clause (or all rows get filtered out).

## Out of scope (Sprint B+)

- Rating display in popover/cards (no curator_rating data populated)
- Sort tabs (no rating data to sort by; can add when ratings exist)
- "Highest Rated" / "Most Reviewed" sort
- Add Review button (needs auth)
- Check-in button (needs auth + table)
- Heart reviews (needs auth + table)
- User photo uploads (needs auth + Storage)
- "Follow" / "Save" / "Report" buttons (needs auth)
- Real reviews list on detail page (needs Sprint B)
- "Highest Rated" sort tab (needs ratings data)

## Testing

- **Unit tests** in `tests/restaurants.test.ts`:
  - `getRestaurants` filter construction: neighborhood-only, dish-only, dietary-only, all three combined
  - Empty arrays for `dishes` / `dietary` should not add filter clauses
- **Manual verification**:
  - Load `/curate` → cards in vertical layout, photos showing
  - Click a 구 chip → list + map filter
  - Click a dish chip → list + map filter
  - Click a vegan/vegetarian/halal chip → list + map filter (only matching rows visible)
  - Click multiple dish chips → OR within row
  - Click a pin → popover appears anchored above pin, with photo + name
  - Click another pin → popover switches
  - Click popover body → navigates to `/restaurant/[slug]`
  - Click "×" on popover → dismisses
  - On detail page: back link returns to listing; Directions opens Kakao Map deeplink; Share copies URL or invokes native share; gallery thumbnail opens lightbox; close lightbox via overlay click or Esc
  - Resize narrow → mobile tabs reappear; filter chip rows scroll horizontally; gallery becomes single-column

## File structure summary

```
taco-tracker/
├── lib/
│   └── restaurants.ts                    [MODIFY]
├── components/
│   ├── filter-chip-row.tsx               [CREATE — replaces neighborhood-filter.tsx]
│   ├── dish-filter.tsx                   [CREATE]
│   ├── dietary-filter.tsx                [CREATE]
│   ├── restaurant-card.tsx               [MODIFY — vertical layout]
│   ├── restaurant-list.tsx               [MODIFY — 3 filter rows]
│   ├── restaurant-detail.tsx             [CREATE]
│   ├── photo-gallery.tsx                 [CREATE]
│   └── map/
│       ├── kakao-map.tsx                 [MODIFY — add popover overlay]
│       ├── map-list-view.tsx             [MODIFY — vertical layout proportions]
│       └── restaurant-popover.tsx        [CREATE]
├── app/[locale]/
│   └── restaurant/[slug]/page.tsx        [CREATE]
├── messages/
│   ├── ko.json                           [MODIFY — new keys]
│   └── en.json                           [MODIFY — new keys]
└── tests/
    └── restaurants.test.ts               [MODIFY — new filter tests]
```
