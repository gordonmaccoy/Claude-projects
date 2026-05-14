# Taco Map — Schema

_Last updated: 2026-04-21_

Postgres via Supabase. Designed for a lean MVP while leaving clean seams for community features and dietary expansion (see [roadmap.md](roadmap.md)).

## Conventions

- Primary keys are `uuid` (generated with `gen_random_uuid()`).
- Every table has `created_at` and `updated_at` (`timestamptz`, default `now()`).
- Text columns default to `text`, not `varchar(n)`.
- Enums use Postgres enum types where stable (`restaurant_status`, `restaurant_style`), `text` with a CHECK constraint where churn is expected (`cuisine`, while we grow into dietary scopes).
- All user-facing strings that belong to a row (name, address, curator note) have `_ko` and `_en` variants. `_ko` is required; `_en` is nullable and falls back to `_ko` in the UI.
- Bilingual fields are stored as sibling columns rather than a `jsonb` blob to keep indexing and querying trivial.

## MVP Tables

### `restaurants`

The only real MVP entity.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `status` | `restaurant_status` enum | `draft` \| `live` \| `archived`. Default `draft`. Only `live` is public. |
| `slug` | `text` UNIQUE | URL segment, e.g. `vatos-urban-tacos-itaewon`. |
| `name_ko` | `text` NOT NULL | |
| `name_en` | `text` | |
| `kakao_place_id` | `text` UNIQUE | Ties back to seeding source; null allowed for manually added rows. |
| `address_ko` | `text` NOT NULL | |
| `address_en` | `text` | |
| `neighborhood` | `text` | Derived at seeding time from address (e.g. `용산구` / `Yongsan-gu`). |
| `lat` | `double precision` NOT NULL | |
| `lng` | `double precision` NOT NULL | |
| `phone` | `text` | |
| `hours` | `jsonb` | Shape: `{mon: "11:00-22:00", tue: "11:00-22:00", ..., sun: null}`. `null` day = closed. |
| `website` | `text` | |
| `instagram` | `text` | Handle without `@`. |
| `cuisine` | `text` NOT NULL CHECK | MVP: only `'mexican'`. Future values: `'halal'`, `'vegan'`, `'vegetarian'`. |
| `style` | `restaurant_style` enum | `authentic_mexican` \| `tex_mex` \| `cal_mex` \| `korean_fusion` \| `other`. |
| `dish_tags` | `text[]` | Controlled vocabulary — see below. |
| `price_band` | `smallint` CHECK (1–3) | Maps to ₩ / ₩₩ / ₩₩₩. |
| `curator_rating` | `numeric(2,1)` CHECK (1.0–5.0) | Half-steps allowed. |
| `curator_note_ko` | `text` | Short blurb (≤280 chars recommended). |
| `curator_note_en` | `text` | |
| `cover_photo_url` | `text` | Single photo for MVP. Future: separate `photos` table. |
| `cover_photo_alt_ko` | `text` | Bilingual alt text — required for accessibility per [design-rules.md](design-rules.md). |
| `cover_photo_alt_en` | `text` | |
| `source` | `text` CHECK | `'kakao'` \| `'manual'` \| `'submission'`. |
| `last_verified_at` | `timestamptz` | When a curator last confirmed the row. |
| `has_vegetarian_options` | `boolean` | Nullable. Populated when known; not surfaced in MVP UI. |
| `has_vegan_options` | `boolean` | Nullable. |
| `is_halal` | `boolean` | Nullable. |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

**Controlled vocabulary — `dish_tags`** (MVP set; extend via migration when a new tag earns three listings):
`al_pastor`, `birria`, `carnitas`, `carne_asada`, `fish_taco`, `shrimp_taco`, `barbacoa`, `chorizo`, `breakfast_taco`, `burrito`, `quesadilla`, `enchilada`, `tamale`, `nachos`, `guacamole`, `margarita`, `michelada`, `churro`.

### `submissions`

Leads from the public `/suggest` form. Never rendered publicly; reviewed in the Supabase dashboard.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `restaurant_name` | `text` NOT NULL | |
| `location_hint` | `text` | Address, neighborhood, or a Kakao Map URL. |
| `notes` | `text` | Free text from submitter. |
| `submitter_email` | `text` | Optional. |
| `submitter_name` | `text` | Optional. |
| `status` | `text` CHECK | `'new'` \| `'reviewed'` \| `'converted'` \| `'rejected'`. Default `'new'`. |
| `admin_notes` | `text` | Private curator notes. |
| `submitter_ip_hash` | `text` | SHA-256 of submitter IP. Used for per-IP rate limiting only; never displayed. |
| `created_at` | `timestamptz` | |

## Indexes

- `restaurants (status)` — most queries filter on `status = 'live'`.
- `restaurants (slug)` — already unique; used on detail pages.
- `restaurants (kakao_place_id)` — unique, used during seeding dedup.
- `restaurants USING gist (ll_to_earth(lat, lng))` — map-bounds queries. (Alternative: `PostGIS` `geography(Point, 4326)`; pick one during implementation.)
- `restaurants USING gin (dish_tags)` — filter UI.
- `submissions (status, created_at desc)` — review queue ordering.

## Row-Level Security

Enable RLS on every table.

- `restaurants`: public `SELECT` where `status = 'live'`. All other operations require `service_role`.
- `submissions`: public `INSERT` only (rate-limited at the app layer). `SELECT`, `UPDATE`, `DELETE` require `service_role`.
- Everything else: `service_role` only.

## Forward-Compatibility Notes

Dietary flags (`has_vegetarian_options`, `has_vegan_options`, `is_halal`) are populated opportunistically during MVP curation even though the MVP UI doesn't surface them. This turns Phase 3 (dietary lens) into a UI change, not a data backfill.

The `cuisine` column is a CHECK-constrained `text` rather than an enum precisely because the dietary expansion will add new values. Enum changes require downtime on some managed Postgres providers; a CHECK constraint is trivial to extend.

## Reserved Future Tables (named now, not built)

These names are reserved to prevent collisions during Phase 2+:

- `users` — Kakao-authenticated accounts.
- `favorites` — `(user_id, restaurant_id)`.
- `reviews` — user-submitted ratings + text, moderated.
- `taco_crawls` — curator- or user-authored multi-stop routes.
- `crawl_stops` — `(crawl_id, restaurant_id, order_index, note)`.
- `feed_posts` — user posts for the Taco Feed.
- `blog_posts` — editorial long-form (may end up as MDX in the repo instead; decide at Phase 2).
- `regions` — introduced when geographic expansion needs more than neighborhood strings.

## Migration Hygiene

All schema changes ship as numbered SQL files under `supabase/migrations/`. No ad-hoc dashboard schema edits — use the dashboard only for row-level content curation.
