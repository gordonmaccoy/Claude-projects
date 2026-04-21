# Taco Tracker Korea — Product Brief

_Last updated: 2026-04-21_

## One-liner

A curated map and directory of Mexican food in South Korea — Korean-first, fully available in English, modeled on [The Guinness Map](https://www.theguinnessmap.com/).

## Problem

Kakao Map and Naver Map list "멕시칸" results but can't tell you whether a place serves authentic al pastor, Tex-Mex burritos, or Korean-Mexican fusion — or whether it's actually any good. Finding the right Mexican spot in Seoul today means skimming generic pins, piecing together blog posts, and hoping for the best. We want to make that a 30-second decision.

## Audience

- **Primary:** Korean locals curious about Mexican food. Korean-first UX.
- **Secondary:** Expats and tourists in Seoul who want authentic picks in English.

The site is fully bilingual (KO default, EN peer). Korean copy is authored first, not translated afterwards.

## MVP Promise

Open the site, see every Mexican spot in Seoul on a map. Each listing tells you:

- **Style:** authentic Mexican, Tex-Mex, Cal-Mex, Korean-Mexican fusion, or other
- **Signature dishes:** tags like al pastor, birria, carnitas, fish tacos, burritos
- **Curator note + rating:** a short bilingual blurb and a 1–5 rating
- **Price band:** ₩ / ₩₩ / ₩₩₩

Search, filter, tap a pin, get the answer fast.

## Out of Scope for MVP

No user accounts, reviews, feeds, blogs, hubs, crawls, native apps, restaurant owner claims, payments, reservations, or delivery integrations. Just map + directory + "suggest a spot" form.

## Success Signals (first 90 days post-launch)

1. ≥80% of publicly known Mexican restaurants in Seoul are live on the site within 60 days of launch.
2. Every live listing has a bilingual curator note and rating.
3. Mobile Lighthouse score ≥90 across Performance, Accessibility, Best Practices, SEO.
4. The `/suggest` form generates ≥5 real new-listing leads per month.
5. Returning visits from a small "share with friends" seed group (~10 people), measured via analytics.

## 12-Month Direction

Expansion is modeled on The Guinness Map's layered structure. See [roadmap.md](roadmap.md) for phasing.

1. **Community layers:** Taco Crawls (curated multi-stop routes) → Kakao login → user submissions go live → reviews → Taco Feed → Taco Hub → Taco Blog.
2. **Dietary lens:** expand from Mexican to halal, vegan, and vegetarian cuisine, surfaced as a filter on the same map and directory. The schema is already built to support this (see [schema.md](schema.md)).
3. **Geographic expansion:** Seoul → Busan → Jeju → national coverage.

## Open Questions (revisit, don't block MVP)

- **Brand at dietary expansion:** "Taco Tracker Korea" works while the focus is Mexican food. When halal/vegan/vegetarian are added, we decide whether to keep the name (with a broader tagline), introduce a parent brand, or split into sibling properties. Defer until Phase 3.
- **Domain:** `tacotracker.kr` is the working assumption; confirm availability and TLD preference during Phase 0.
- **Analytics provider:** Vercel Analytics vs. Plausible vs. neither. Pick in Phase 0.
