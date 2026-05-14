# Taco Map — Architecture

_Last updated: 2026-04-21_

## Stack

| Concern | Choice | Why |
|---|---|---|
| Web framework | **Next.js (App Router)** | Server components + ISR fit a mostly-read content site. |
| Hosting | **Vercel** | Zero-config Next.js deploys; edge caching; preview deploys per PR. |
| Database | **Supabase (Postgres)** | Hosted Postgres + first-class Kakao OAuth for Phase 2; dashboard doubles as MVP admin UI. |
| Styling | **Tailwind CSS + shadcn/ui** | Token-driven styling that matches the design-rules palette; shadcn for accessible primitives. |
| Map | **Kakao Maps JS SDK** | Native Korean POIs, familiar to our primary audience; see [product-brief.md](product-brief.md). |
| Data seeding | **Kakao Local REST API** → Node script → Supabase | Semi-curated pipeline, reviewed in Supabase dashboard. |
| i18n | **`next-intl`** | Locale-prefixed routes (`/ko`, `/en`), Korean default. |
| Analytics | **TBD (Vercel Analytics or Plausible)** | Decided in Phase 0. |

## Page Structure (MVP)

All pages live under a `[locale]` segment — `ko` (default) or `en`.

- `/` → `/[locale]` — the map page: Kakao Map on the left/top, filter bar, listing list on the right/bottom. Responsive single-pane on mobile (tabbed: Map | List).
- `/[locale]/r/[slug]` — restaurant detail page. SSR'd, SEO-friendly URLs. Shows hero photo, bilingual name/address, hours, style/dish tags, curator note, rating, price, website/instagram, "open in Kakao Map" link.
- `/[locale]/suggest` — suggest-a-spot form.
- `/[locale]/about` — one static page.

## Rendering Strategy

- Detail pages and the map page use **ISR** (revalidate ~1 hour) so curator edits propagate without a redeploy.
- The map itself renders client-side (Kakao Maps JS SDK), hydrated with the current viewport's live listings from a server component.
- `/suggest` is a dynamic page with a Server Action for submission.
- No middleware beyond locale routing and IP rate-limiting on `/suggest`.

## Data Flow

### 1. Seeding (offline, manual)

```
scripts/seed-from-kakao.ts
  ├─ Query Kakao Local for ["멕시칸", "타코", "부리또"] across Seoul districts
  ├─ Dedup by kakao_place_id
  ├─ Normalize into restaurants rows with status='draft'
  └─ Upsert to Supabase (service-role key, kept local to the script env)
```

Run manually during Phase 1 when expanding coverage. A curator then reviews each `draft` row in the Supabase dashboard, fills in style / dish_tags / curator_note_* / curator_rating / price_band, and flips `status` to `live`.

### 2. Public reads

```
User → Next.js server component → Supabase (anon key, RLS-filtered to status='live') → HTML
```

The map page fetches listings within a generous Seoul-wide bounding box once server-side, then filters client-side as the user pans/zooms (avoids per-pan round-trips for MVP scale of ~50–200 rows). Switch to bounds-parameterized fetches when rows exceed ~500.

### 3. Submissions

```
User submits /suggest form → Server Action → rate-limit check (IP) → insert into submissions
```

No email sent on submission for MVP. Curator reviews the queue in Supabase on a weekly cadence.

## Repo Layout

```
taco-tracker/
├─ app/
│  ├─ [locale]/
│  │  ├─ layout.tsx
│  │  ├─ page.tsx              # map + list
│  │  ├─ r/[slug]/page.tsx     # detail
│  │  ├─ suggest/page.tsx
│  │  └─ about/page.tsx
│  └─ api/                     # reserved; MVP uses Server Actions instead
├─ components/
│  ├─ Map/                     # Kakao map wrapper, pins, clustering
│  ├─ Listing/                 # ListingCard, ListingList, ListingDetail
│  ├─ Filters/                 # FilterBar, StyleChips, DishTagPicker
│  └─ ui/                      # shadcn primitives
├─ lib/
│  ├─ supabase.ts              # server + browser clients
│  ├─ kakao.ts                 # map init, Local API helpers
│  ├─ i18n.ts                  # next-intl config
│  └─ rate-limit.ts            # per-IP daily cap on /suggest, enforced by querying the submissions table
├─ scripts/
│  └─ seed-from-kakao.ts
├─ messages/
│  ├─ ko.json                  # primary
│  └─ en.json
├─ supabase/
│  └─ migrations/              # numbered SQL files
└─ docs/                        # this folder
```

## Internationalization

- Locale is a URL segment (`/ko/...`, `/en/...`). No cookie-based locale switching — URLs are canonical.
- UI strings live in `messages/ko.json` and `messages/en.json`. Korean is authored first; English is a peer, not a machine translation.
- Row-level bilingual fields (`name_ko` / `name_en`, etc.) come from the database. UI falls back to `_ko` if `_en` is empty.
- Language toggle in the header swaps the locale segment without losing the current path.

## Secrets & Environment

All secrets in Vercel env vars (Development, Preview, Production). Never committed to git.

| Variable | Scope | Purpose |
|---|---|---|
| `SUPABASE_URL` | public | Client + server. |
| `SUPABASE_ANON_KEY` | public | Browser-safe, RLS-gated. |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Seeding script, Server Actions where needed. Never sent to browser. |
| `KAKAO_REST_API_KEY` | server only | Local API during seeding. |
| `NEXT_PUBLIC_KAKAO_JS_KEY` | public | Maps JS SDK init. Restrict by domain in Kakao dev console. |

## Deployment

- `main` branch auto-deploys to production on Vercel.
- PRs get preview deploys at `*-git-*.vercel.app` URLs.
- One shared Supabase project for MVP; `draft` status isolates in-progress rows from the public site. Introduce a separate staging Supabase project only if the content team grows beyond one person.
- Migrations run via the Supabase CLI in CI on merge to `main`.

## What We Are *Not* Building for MVP

- No custom admin UI — the Supabase dashboard is the admin.
- No user auth, no sessions, no server-side user state.
- No image uploads — `cover_photo_url` is a URL pasted in during curation.
- No background jobs, queues, or cron — seeding is a manual script.
- No email sending, no transactional messages.
- No full-text search — filters (style + dish tags + price) plus map geography cover MVP needs.
