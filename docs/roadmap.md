# Taco Tracker Korea — Roadmap

_Last updated: 2026-05-14_

Phased, no hard dates. Each phase gates on the previous one being real and usable. Each phase gets its own brainstorm → spec → plan cycle when we start it — this roadmap is the shape, not the plan.

## Phase 0 — Foundation ✅ Complete

- [x] Five foundation docs: [product-brief.md](product-brief.md), [schema.md](schema.md), [architecture.md](architecture.md), [design-rules.md](design-rules.md), [roadmap.md](roadmap.md).
- [x] Supabase project created; initial migration applied.
- [x] Next.js scaffold pushed to GitHub and Vercel; deployed at `taco-tracker-alpha.vercel.app`.
- [x] Kakao developer account + REST API key obtained; Local API enabled.
- [ ] Decide: analytics provider (Vercel Analytics vs. Plausible vs. none).
- [ ] Decide: domain (assumption: `tacotracker.kr`; confirm availability).

## Phase 1 — MVP: Taco Map Seoul

**Goal:** public launch with map + directory + suggestions. Ship it small and real.

Estimated effort: ~4–6 weeks of focused work. Adjust once we write the implementation plan.

Scope:

- [x] Schema migration + RLS policies applied to Supabase.
- [x] `scripts/seed-from-kakao.ts` produces ≥50 Seoul restaurant drafts (109 seeded).
- [x] Enrichment script populates `name_en`, `dish_tags`, dietary flags from `name_ko`.
- [ ] Curation pass: every live row has style, dish tags, price, rating, and bilingual curator note. (24 promoted to `live` so far; English names added manually.)
- [x] Restaurant listing pages (`/`, `/curate`) with neighborhood filter chips and bilingual cards.
- [ ] Kakao Map view + list/map toggle. (← **NEXT**)
- [ ] Restaurant detail page with SSR and SEO metadata.
- [ ] `/suggest` form writes to `submissions` with IP rate-limiting.
- [x] i18n wired with `/` (KO) and `/en` (EN); locale routing via next-intl.
- [ ] Analytics integrated (provider chosen in Phase 0).
- [ ] Mobile Lighthouse ≥90 across Performance / Accessibility / Best Practices / SEO.

**Launch criterion:** ≥30 live listings, mobile Lighthouse ≥90, shareable `tacotracker.kr` URL sent to ~10 friends for feedback.

## Phase 2 — Community Layers

Ordered; each sub-phase is independently shippable.

1. **Kakao login** — Supabase auth with Kakao OAuth provider. Unlocks user-specific features. Adds `users` table.
2. **Favorites** — heart a restaurant. DB-synced when logged in; local-storage fallback when anonymous.
3. **Taco Crawls** — curator-authored multi-stop routes first (e.g. "Itaewon crawl: 3 spots, one afternoon"). Adds `taco_crawls` and `crawl_stops` tables. No user-created crawls yet.
4. **User submissions go live-ish** — `/suggest` submissions auto-create `draft` restaurants with `source='submission'`. Curator approves in Supabase dashboard to flip to `live`.
5. **Reviews** — 1–5 rating + text on restaurants, moderated before they appear. Adds `reviews` table.
6. **Photo uploads** — Supabase Storage backs user-uploaded restaurant photos. Fills out the visual gap on cards and detail pages. Adds `photos` table.
7. **Taco Feed** — user posts (photo + short text + tagged restaurant), chronological. Adds `feed_posts` table.
8. **"Best of" rankings** — separate leaderboards per dish (best tacos, best burritos, best margaritas, etc.) derived from review ratings and curator picks.
9. **Taco Points / gamification** — points for checking in, reviewing, posting photos, suggesting spots. Leaderboard ranks users by reviews / photos / total points. Adds `taco_points` table.
10. **Taco Hub** — community landing: top-rated restaurants, most-active users, featured crawls.
11. **Taco Blog** — editorial long-form. Start as MDX in the repo (no CMS). Introduce `blog_posts` only when editorial team grows.

Each item above is its own brainstorm → spec → plan cycle.

## Phase 3 — Dietary Lens Expansion

Expand from Mexican-only to include halal, vegan, and vegetarian. The schema already supports this (see [schema.md](schema.md)).

- Surface `has_vegetarian_options`, `has_vegan_options`, `is_halal` in the filter UI.
- Extend `cuisine` CHECK constraint to accept `'halal'`, `'vegan'`, `'vegetarian'`.
- Run fresh Kakao seeding rounds per new cuisine (keywords per language, per cuisine).
- Curate each new cuisine to launch parity: every live row has bilingual curator note, style/dish analog, price, rating.
- Add a top-level "cuisine" switcher (KO: 카테고리; EN: Cuisine) to the filter bar.
- **Open question resurfaces:** keep "Taco Tracker Korea" as brand, retitle to something broader, or split into sibling properties under a parent brand. Revisit before shipping Phase 3.

## Phase 4 — Geographic Expansion

- Busan → Jeju → national coverage.
- Introduce `regions` table once neighborhood strings become insufficient.
- Seeding script takes a `--region` flag.
- Landing page grows a region picker; default remains Seoul.
- i18n scales fine; Korean neighborhood names already render correctly.

## Explicitly Not Planned

- Native mobile apps. PWA is sufficient until sustained usage and user demand justify native.
- Payments, reservations, or delivery integration. Those are other products.
- Restaurant-owner / claim-your-listing flow. Build only if a real owner asks. For now, curator owns the truth.
- AI-generated reviews or photos. All content on the site is human-authored.

## Decision Log (updates as we go)

Kept here to avoid re-litigating. Add entries dated and signed as phases conclude.

- **2026-04-21** — Chose Kakao Map over Google/Naver/Mapbox, Korean-first UX with English peer, Supabase for DB + future Kakao auth, semi-curated seeding via Kakao Local API. Modeled structure on The Guinness Map.
- **2026-05-13** — Shipped Kakao seeding pipeline (109 drafts) and bulk enrichment script (name_en, dish_tags, dietary flags from name_ko).
- **2026-05-14** — Shipped restaurant listing pages (`/`, `/curate`) with neighborhood filter, Layout B (horizontal rows), cards linking to Kakao Place. `/curate` uses service-role client to bypass RLS for drafts; secret-URL pattern, no auth yet. Photo gap acknowledged — deferred until curator photos or Phase 2 user-upload feature lands.
