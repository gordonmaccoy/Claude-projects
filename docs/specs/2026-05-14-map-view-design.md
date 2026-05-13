# Map View — Design Spec

_Date: 2026-05-14_

## Goal

Add a Kakao Maps view to the home page (`/`) and curate page (`/curate`) alongside the existing restaurant list. Make the listing pages feel like the Guinness Map: a map of pins on one side, a synchronized list of cards on the other. Establishes the Kakao Maps integration that future features (geolocation, distance-sort) will build on.

## Context

After Phase 1 listing pages shipped, both `/` and `/curate` show horizontal-row restaurant cards filtered by neighborhood chips. The map is the next-most distinctive feature from the Guinness Map reference. Architecture (`docs/architecture.md`) already commits to Kakao Maps JS SDK with client-side rendering hydrated from a server fetch. This spec covers the integration.

## Routes & Integration

- **`/` and `/en`** — home, map + list of `status='live'` restaurants
- **`/curate` and `/en/curate`** — curator view, `status='draft'` restaurants
- Both routes use the same `<MapListView>` component; only the `status` prop differs
- The existing `<RestaurantList>` server component is reused for the list half

## Desktop Layout (≥768px)

- Two columns: **map 60% / list 40%**
- Map column: sticky to viewport, height = `100vh - header`
- List column: scrolls vertically inside the column
- Filter chips sit ABOVE both columns (controls both)
- Result count remains in the list-column header

## Mobile Layout (<768px)

- Segmented tab control at top: **Map | List** (terracotta active state, matches design-rules.md tag chips)
- Default tab: **Map**
- Filter chips persist across both tabs (sit between page title and tabs)
- Only one of map / list is rendered at a time to save memory

## Pin Design

Per `docs/design-rules.md`:
- Flat terracotta taco-wedge silhouette with mole-brown outline
- ~32px on screen
- Active pin: cream fill, terracotta outline (inverted)
- Cluster bubbles: terracotta circle with cream numeral, shown at zoom level 10 and below
- SVG implementation (delivered via Kakao's `CustomOverlay` or `MarkerImage`)

## Interactions

| Trigger | Behavior |
|---|---|
| Pin click | Corresponding card scrolls into view (`scrollIntoView({ block: 'center', behavior: 'smooth' })`) and gains active state: 2px terracotta (`--color-brand`) border replacing the default subtle border, deeper shadow. Pin becomes active (cream fill, terracotta outline). |
| Pin click on already-active pin | Deactivate (return to default state). |
| Card hover (desktop only) | Matching pin briefly highlights (subtle scale-up). Does NOT pan/zoom the map. |
| Card click | Opens `https://place.map.kakao.com/{kakao_place_id}` in a new tab (unchanged from current behavior). |
| Neighborhood chip click | Filters BOTH the list and the pins. Map re-fits bounds to remaining pins with ~40px padding. |
| Map drag / zoom | List does NOT re-filter to viewport (MVP scale ~24 live / 108 draft is small enough to show all rows). |

## Initial Map State

- Bounds-fit to all currently visible pins with ~40px padding
- Fallback to fixed Seoul-wide view (center: `37.5665, 126.9780`, level: 8) if no pins
- Default zoom adapts to the bounds-fit calculation

## State Management

`<MapListView>` is a client component that owns:
- `activeRestaurantId: string | null` — currently selected restaurant
- `hoveredRestaurantId: string | null` — currently hovered card (desktop) for pin highlight

These flow down as props to `<KakaoMap>` and `<RestaurantList>` (which is converted to accept these props instead of being purely server-rendered).

URL state (neighborhood filter) continues to live in `searchParams` and triggers a server re-render — pin filtering happens because the server re-renders with new data.

## Empty & Error States

- Kakao Maps SDK fails to load: muted banner above the page ("Map unavailable, showing list only"), map column collapses to 0%, list takes full width
- No pins to show: list shows existing empty-state message ("No restaurants match these filters."), map renders Seoul-wide view with no pins
- Slow SDK load: show a centered "Loading map..." text in the map column (only shown after 500ms to avoid flash on fast loads)

## Component File Structure

| Path | Responsibility | Type |
|---|---|---|
| `components/map/kakao-map.tsx` | Wraps Kakao Maps SDK, manages map instance, pins, clusters, active/hover state, bounds-fit | client |
| `components/map/pin-icon.tsx` | Pure SVG taco-wedge pin (default + active variants), returns SVG markup string for Kakao's `MarkerImage` | pure |
| `components/map/map-list-view.tsx` | Owns active/hover state. Renders `<KakaoMap>` + list, handles desktop split / mobile tabs | client |
| `components/restaurant-card.tsx` | Modify: accept optional `isActive`, `onMouseEnter`, `onMouseLeave`, `onClick` props. Render active border when `isActive`. | server (with client interactivity through wrapper) |
| `app/[locale]/page.tsx` | Modify: render `<MapListView status="live" />` | server |
| `app/[locale]/curate/page.tsx` | Modify: render `<MapListView status="draft" />` (banner and title unchanged) | server |
| `lib/kakao-maps.ts` | Helper: load SDK once, return promise resolving to `kakao.maps` namespace | client-only |

Note: Making `<RestaurantCard>` interactive while keeping it server-renderable means `<MapListView>` (a client component) maps over restaurant data and renders the cards. The cards themselves can remain plain JSX since they're rendered inside a client component.

## Environment & Config

- Requires `NEXT_PUBLIC_KAKAO_JS_KEY` environment variable
- Obtain from Kakao Developer Console (https://developers.kakao.com) — distinct from the REST API key already used for seeding
- Whitelist domains: `localhost:3000`, `taco-tracker-alpha.vercel.app`, and any future production domain
- SDK loaded asynchronously via injected `<script>` tag with `autoload=false` (then `kakao.maps.load()` to actually init)

## Testing

- Unit tests for `pin-icon.tsx` — renders default/active variants correctly
- Unit tests for any pure helpers in `kakao-map.tsx` (e.g. bounds-fit calculation if extracted)
- Manual verification:
  - Load `/curate` with map: 108 pins visible, clustered when zoomed out
  - Click a pin → corresponding card scrolls into view, both highlight
  - Hover a card → matching pin highlights briefly
  - Click a neighborhood chip → map zooms to that district's pins, list filters
  - Resize browser narrow → tab bar appears, only one half visible
  - Tab between Map and List on mobile
  - Click card → opens Kakao Place in new tab
- Manual i18n check: `/en/curate` shows English page chrome, same map behavior

## Out of Scope (Phase 2+)

- Geolocation / "tacos near you" / device location permission
- Distance display on cards ("X m away")
- Sort by distance
- Inline pin popover (Option C from brainstorming; the user requested this for a later phase)
- Viewport-bounded filtering (re-filter list as user pans)
- URL state for map center/zoom
- Map styling customization (street colors, label font) — use Kakao defaults
- Search by address / point of interest
- Heat map / density visualization
