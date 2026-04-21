# Taco Tracker Korea — MVP Part 1: Foundation & Schema

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a Next.js 15 app in `taco-tracker/` with Tailwind v4, shadcn/ui, i18n (Korean default + English), Supabase client wrappers, initial schema migrations, and RLS policies — resulting in a deployed empty site with a live, protected Postgres database.

**Architecture:** Next.js 15 App Router in a `taco-tracker/` subdirectory. Supabase (Postgres) for data. Locale-prefixed routing via next-intl (`/ko/*` is root by default, `/en/*` for English). See [docs/architecture.md](../architecture.md).

**Tech stack:** Next.js 15, TypeScript, pnpm, Tailwind v4, shadcn/ui, next-intl, @supabase/supabase-js, @supabase/ssr, Vitest, Supabase CLI.

**This is Part 1 of 4.** Subsequent plans:
- Part 2: Seeding pipeline (Kakao Local API → Supabase drafts + curation workflow)
- Part 3: Map & directory (home page, restaurant detail page)
- Part 4: Suggest form, /about, analytics, Lighthouse, launch

---

## Prerequisites (complete before starting any task)

These are account/tool setup steps — do them manually before running any commands below.

- [ ] **Supabase project:** Create a free project at [supabase.com](https://supabase.com). Copy the **Project URL**, **anon key**, and **service role key** from Settings → API.
- [ ] **Kakao dev account:** Register at [developers.kakao.com](https://developers.kakao.com), create an app, note the **REST API key** and **JavaScript SDK key**. (Not used until Part 2, but register now.)
- [ ] **Vercel account:** Sign up at [vercel.com](https://vercel.com). Install the CLI: `pnpm add -g vercel`.
- [ ] **Tools:** Confirm `node -v` ≥ 20 and `pnpm -v` ≥ 9. If pnpm is missing: `npm install -g pnpm`.

---

## File Structure

All paths are relative to `taco-tracker/` once scaffolded. The `taco-tracker/` directory lives at the root of the repo, alongside the existing `Countdown/` folder.

```
taco-tracker/
├── app/
│   ├── globals.css              # Tailwind v4 + design tokens
│   ├── layout.tsx               # Root layout (font loading)
│   └── [locale]/
│       ├── layout.tsx           # next-intl provider
│       └── page.tsx             # Home placeholder
├── i18n/
│   └── routing.ts               # next-intl locale config
├── i18n.ts                      # next-intl request config
├── middleware.ts                # Locale routing middleware
├── messages/
│   ├── ko.json                  # Korean strings (primary)
│   └── en.json                  # English strings
├── lib/supabase/
│   ├── server.ts                # createServerClient wrapper
│   └── client.ts                # createBrowserClient wrapper
├── tests/
│   ├── i18n.test.ts
│   ├── supabase-client.test.ts
│   └── schema.test.ts
├── supabase/
│   ├── config.toml
│   └── migrations/
│       ├── 20260421000000_initial_schema.sql
│       └── 20260421000001_rls_policies.sql
├── vitest.config.ts
├── next.config.ts
├── .env.local.example
└── .env.local                   # Never committed — gitignored
```

---

## Task 1: Scaffold the Next.js app + shadcn/ui

**Files:** Creates the entire `taco-tracker/` scaffold plus `components.json`.

- [ ] **Step 1: Run scaffold from the repo root**

From the directory that contains `Countdown/` and `CLAUDE.md`:

```bash
pnpm create next-app@latest taco-tracker \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --no-eslint
```

Accept all prompts with defaults. This creates `taco-tracker/` with Next.js 15, TypeScript, Tailwind, and the App Router.

- [ ] **Step 2: Move into the project for all subsequent tasks**

```bash
cd taco-tracker
```

- [ ] **Step 3: Initialise shadcn/ui**

```bash
pnpm dlx shadcn@latest init
```

When prompted:
- Style: **Default**
- Base color: **Neutral** (we override all colors with our tokens in Task 2)
- CSS variables: **Yes**

- [ ] **Step 4: Verify the scaffold runs**

```bash
pnpm dev
```

Expected: `▲ Next.js 15.x.x` in terminal, default Next.js page at `http://localhost:3000`. No errors. Stop the server (`Ctrl+C`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 15 + shadcn/ui in taco-tracker/"
```

---

## Task 2: Apply design tokens + typography

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Replace `app/globals.css` entirely**

```css
@import "tailwindcss";

@theme {
  /* Colors — from design-rules.md */
  --color-bg: #F7F2E8;
  --color-surface: #FFFBF2;
  --color-ink: #1B1916;
  --color-muted: #8A8177;
  --color-brand: #C84B2F;
  --color-brand-deep: #3B2A1F;
  --color-accent: #7A9F3A;

  /* Border radius */
  --radius-md: 8px;
  --radius-lg: 16px;
  --radius-full: 9999px;

  /* Shadow */
  --shadow-card: 0 2px 8px rgba(27, 25, 22, 0.08);

  /* Fonts */
  --font-sans: 'Pretendard Variable', 'Pretendard', system-ui, sans-serif;
  --font-display: 'Fraunces', Georgia, serif;
}

/* Pretendard — CDN for now, self-host in production */
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css');

html {
  background-color: var(--color-bg);
  color: var(--color-ink);
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.55;
}
```

> **Tailwind v3 note:** If `package.json` shows `"tailwindcss": "^3.x"`, the `@theme {}` block won't work. Upgrade to v4: `pnpm add tailwindcss@next @tailwindcss/postcss@next` and update `postcss.config.mjs` to use `@tailwindcss/postcss`. Then retry this step.

- [ ] **Step 2: Load Fraunces via next/font in `app/layout.tsx`**

```typescript
import { Fraunces } from 'next/font/google'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={fraunces.variable}>
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 3: Smoke test the tokens**

Replace `app/page.tsx` temporarily:

```typescript
export default function Home() {
  return (
    <main style={{ minHeight: '100vh', padding: 32, background: 'var(--color-bg)' }}>
      <h1 style={{ color: 'var(--color-brand)', fontFamily: 'var(--font-display)', fontSize: 32 }}>
        Taco Tracker Korea
      </h1>
      <p style={{ color: 'var(--color-ink)' }}>Design tokens applied.</p>
    </main>
  )
}
```

Run `pnpm dev`. Expected: cream background, terracotta serif headline, charcoal paragraph.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css app/layout.tsx app/page.tsx
git commit -m "feat: apply design tokens and Fraunces/Pretendard fonts"
```

---

## Task 3: Configure next-intl (Korean default + English)

**Files:**
- Create: `i18n/routing.ts`, `i18n.ts`, `middleware.ts`
- Create: `messages/ko.json`, `messages/en.json`
- Create: `app/[locale]/layout.tsx`, `app/[locale]/page.tsx`
- Modify: `next.config.ts`
- Delete: `app/page.tsx`

- [ ] **Step 1: Install next-intl**

```bash
pnpm add next-intl
```

- [ ] **Step 2: Create `i18n/routing.ts`**

```typescript
import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['ko', 'en'] as const,
  defaultLocale: 'ko',
  localePrefix: 'as-needed', // / serves Korean; /en serves English
})
```

- [ ] **Step 3: Create `i18n.ts`**

```typescript
import { getRequestConfig } from 'next-intl/server'
import { routing } from './i18n/routing'

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale
  if (!locale || !(routing.locales as readonly string[]).includes(locale)) {
    locale = routing.defaultLocale
  }
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  }
})
```

- [ ] **Step 4: Create `middleware.ts`**

```typescript
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

export default createMiddleware(routing)

export const config = {
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
}
```

- [ ] **Step 5: Create `messages/ko.json`**

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
  }
}
```

- [ ] **Step 6: Create `messages/en.json`**

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
  }
}
```

- [ ] **Step 7: Create `app/[locale]/layout.tsx`**

```typescript
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!(routing.locales as readonly string[]).includes(locale)) notFound()
  const messages = await getMessages()
  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
```

- [ ] **Step 8: Create `app/[locale]/page.tsx`**

```typescript
import { useTranslations } from 'next-intl'

export default function HomePage() {
  const t = useTranslations('home')
  return (
    <main style={{ minHeight: '100vh', padding: 32, background: 'var(--color-bg)' }}>
      <h1 style={{ color: 'var(--color-brand)', fontFamily: 'var(--font-display)', fontSize: 32 }}>
        {t('heading')}
      </h1>
    </main>
  )
}
```

- [ ] **Step 9: Delete the old root page**

```bash
rm app/page.tsx
```

- [ ] **Step 10: Update `next.config.ts` to wrap with next-intl plugin**

```typescript
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n.ts')

const nextConfig: NextConfig = {}

export default withNextIntl(nextConfig)
```

- [ ] **Step 11: Verify both locales**

```bash
pnpm dev
```

- `http://localhost:3000` → Korean: "서울의 타코 & 멕시코 음식" on cream background.
- `http://localhost:3000/en` → English: "Tacos & Mexican Food in Seoul".
- No 404s, no console errors.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: configure next-intl with Korean default and English locales"
```

---

## Task 4: Add Vitest + first passing tests

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/i18n.test.ts`

- [ ] **Step 1: Install Vitest**

```bash
pnpm add -D vitest @vitejs/plugin-react vite-tsconfig-paths
```

- [ ] **Step 2: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
  },
})
```

- [ ] **Step 3: Add test scripts to `package.json`**

In the `"scripts"` section, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write the test**

Create `tests/i18n.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { routing } from '../i18n/routing'

describe('i18n routing config', () => {
  it('supports ko and en locales', () => {
    expect(routing.locales).toContain('ko')
    expect(routing.locales).toContain('en')
  })

  it('defaults to Korean', () => {
    expect(routing.defaultLocale).toBe('ko')
  })
})
```

- [ ] **Step 5: Run and confirm passing**

```bash
pnpm test
```

Expected:
```
✓ tests/i18n.test.ts (2)
  ✓ i18n routing config > supports ko and en locales
  ✓ i18n routing config > defaults to Korean

Test Files  1 passed (1)
Tests  2 passed (2)
```

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts tests/i18n.test.ts package.json
git commit -m "feat: add Vitest with i18n routing tests"
```

---

## Task 5: Supabase client wrappers

**Files:**
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/client.ts`
- Create: `.env.local.example`
- Create: `.env.local` (user-created, never committed)
- Create: `tests/supabase-client.test.ts`

- [ ] **Step 1: Install Supabase libraries**

```bash
pnpm add @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Create `.env.local.example`**

```bash
# Copy to .env.local and fill in from Supabase Dashboard → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- [ ] **Step 3: Create `.env.local`** (manual)

Copy `.env.local.example` to `.env.local` and fill in the three values from your Supabase dashboard. Confirm `.env.local` is listed in `.gitignore` before continuing.

- [ ] **Step 4: Write the failing tests**

Create `tests/supabase-client.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('Supabase client modules', () => {
  it('server module exports a createClient function', async () => {
    const mod = await import('../lib/supabase/server')
    expect(typeof mod.createClient).toBe('function')
  })

  it('browser module exports a createClient function', async () => {
    const mod = await import('../lib/supabase/client')
    expect(typeof mod.createClient).toBe('function')
  })
})
```

- [ ] **Step 5: Run to confirm they fail**

```bash
pnpm test tests/supabase-client.test.ts
```

Expected: 2 failures — `Cannot find module '../lib/supabase/server'`

- [ ] **Step 6: Create `lib/supabase/server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

- [ ] **Step 7: Create `lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 8: Run all tests — expect 4 passing**

```bash
pnpm test
```

Expected:
```
✓ tests/i18n.test.ts (2)
✓ tests/supabase-client.test.ts (2)

Test Files  2 passed (2)
Tests  4 passed (4)
```

- [ ] **Step 9: Commit**

```bash
git add lib/supabase/ tests/supabase-client.test.ts .env.local.example
git commit -m "feat: add Supabase server and browser client wrappers"
```

---

## Task 6: Supabase CLI init + link

**Files:**
- Create: `supabase/config.toml`

- [ ] **Step 1: Initialise Supabase in the project**

```bash
pnpm dlx supabase init
```

Expected: creates `supabase/` directory with `config.toml`.

- [ ] **Step 2: Link to your remote Supabase project**

```bash
pnpm dlx supabase link
```

You'll be prompted for your project reference — find it in your Supabase dashboard URL: `https://supabase.com/dashboard/project/<your-ref>`. Enter it and your database password (Settings → Database).

- [ ] **Step 3: Verify the link**

```bash
pnpm dlx supabase status
```

Expected: shows your project URL and confirms the link.

- [ ] **Step 4: Commit**

```bash
git add supabase/config.toml
git commit -m "chore: initialise and link Supabase CLI project"
```

---

## Task 7: Write the initial schema migration

**Files:**
- Create: `tests/schema.test.ts`
- Create: `supabase/migrations/20260421000000_initial_schema.sql`

- [ ] **Step 1: Write the failing test**

Create `tests/schema.test.ts`:

```typescript
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'

const sql = readFileSync(
  'supabase/migrations/20260421000000_initial_schema.sql',
  'utf8'
)

describe('initial schema migration', () => {
  it('defines restaurant_status enum', () => {
    expect(sql).toContain("CREATE TYPE restaurant_status AS ENUM")
  })

  it('defines restaurant_style enum', () => {
    expect(sql).toContain("CREATE TYPE restaurant_style AS ENUM")
  })

  it('creates the restaurants table', () => {
    expect(sql).toContain('CREATE TABLE restaurants')
  })

  it('creates the submissions table', () => {
    expect(sql).toContain('CREATE TABLE submissions')
  })

  it('includes bilingual alt text columns', () => {
    expect(sql).toContain('cover_photo_alt_ko')
    expect(sql).toContain('cover_photo_alt_en')
  })

  it('includes IP hash for rate limiting', () => {
    expect(sql).toContain('submitter_ip_hash')
  })
})
```

- [ ] **Step 2: Run to confirm they fail**

```bash
pnpm test tests/schema.test.ts
```

Expected: all 6 fail — file not found.

- [ ] **Step 3: Create `supabase/migrations/20260421000000_initial_schema.sql`**

```sql
-- Enums
CREATE TYPE restaurant_status AS ENUM ('draft', 'live', 'archived');

CREATE TYPE restaurant_style AS ENUM (
  'authentic_mexican',
  'tex_mex',
  'cal_mex',
  'korean_fusion',
  'other'
);

-- Restaurants table
CREATE TABLE restaurants (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  status                  restaurant_status NOT NULL DEFAULT 'draft',
  slug                    TEXT        UNIQUE NOT NULL,
  name_ko                 TEXT        NOT NULL,
  name_en                 TEXT,
  kakao_place_id          TEXT        UNIQUE,
  address_ko              TEXT        NOT NULL,
  address_en              TEXT,
  neighborhood            TEXT,
  lat                     DOUBLE PRECISION NOT NULL,
  lng                     DOUBLE PRECISION NOT NULL,
  phone                   TEXT,
  hours                   JSONB,
  website                 TEXT,
  instagram               TEXT,
  cuisine                 TEXT        NOT NULL DEFAULT 'mexican'
                            CHECK (cuisine IN ('mexican', 'halal', 'vegan', 'vegetarian')),
  style                   restaurant_style,
  dish_tags               TEXT[]      NOT NULL DEFAULT '{}',
  price_band              SMALLINT    CHECK (price_band BETWEEN 1 AND 3),
  curator_rating          NUMERIC(2,1) CHECK (curator_rating BETWEEN 1.0 AND 5.0),
  curator_note_ko         TEXT,
  curator_note_en         TEXT,
  cover_photo_url         TEXT,
  cover_photo_alt_ko      TEXT,
  cover_photo_alt_en      TEXT,
  source                  TEXT        CHECK (source IN ('kakao', 'manual', 'submission')),
  last_verified_at        TIMESTAMPTZ,
  has_vegetarian_options  BOOLEAN,
  has_vegan_options       BOOLEAN,
  is_halal                BOOLEAN,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Submissions table
CREATE TABLE submissions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_name     TEXT        NOT NULL,
  location_hint       TEXT,
  notes               TEXT,
  submitter_email     TEXT,
  submitter_name      TEXT,
  submitter_ip_hash   TEXT,
  status              TEXT        NOT NULL DEFAULT 'new'
                        CHECK (status IN ('new', 'reviewed', 'converted', 'rejected')),
  admin_notes         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_restaurants_status
  ON restaurants (status);

CREATE INDEX idx_restaurants_lat_lng
  ON restaurants (lat, lng);

CREATE INDEX idx_restaurants_dish_tags
  ON restaurants USING GIN (dish_tags);

CREATE INDEX idx_submissions_status_created
  ON submissions (status, created_at DESC);

-- Auto-update updated_at on restaurants
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER restaurants_updated_at
  BEFORE UPDATE ON restaurants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

- [ ] **Step 4: Run tests — expect all 6 to pass**

```bash
pnpm test tests/schema.test.ts
```

Expected:
```
✓ tests/schema.test.ts (6)
  ✓ defines restaurant_status enum
  ✓ defines restaurant_style enum
  ✓ creates the restaurants table
  ✓ creates the submissions table
  ✓ includes bilingual alt text columns
  ✓ includes IP hash for rate limiting
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260421000000_initial_schema.sql tests/schema.test.ts
git commit -m "feat: add initial schema migration (restaurants + submissions + indexes)"
```

---

## Task 8: Write the RLS policies migration

**Files:**
- Create: `supabase/migrations/20260421000001_rls_policies.sql`
- Modify: `tests/schema.test.ts` (add RLS tests)

- [ ] **Step 1: Add failing RLS tests to `tests/schema.test.ts`**

Append to the end of `tests/schema.test.ts`:

```typescript
const rls = readFileSync(
  'supabase/migrations/20260421000001_rls_policies.sql',
  'utf8'
)

describe('RLS policies migration', () => {
  it('enables RLS on restaurants', () => {
    expect(rls).toContain('ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY')
  })

  it('enables RLS on submissions', () => {
    expect(rls).toContain('ALTER TABLE submissions ENABLE ROW LEVEL SECURITY')
  })

  it('restricts public reads to live rows', () => {
    expect(rls).toContain("status = 'live'")
  })

  it('allows public inserts on submissions', () => {
    expect(rls).toContain('FOR INSERT')
  })
})
```

- [ ] **Step 2: Run to confirm new tests fail**

```bash
pnpm test tests/schema.test.ts
```

Expected: first 6 pass, last 4 fail — file not found.

- [ ] **Step 3: Create `supabase/migrations/20260421000001_rls_policies.sql`**

```sql
-- Enable Row Level Security
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- restaurants: anonymous and authenticated users can read live rows
CREATE POLICY "Public read live restaurants"
  ON restaurants
  FOR SELECT
  TO anon, authenticated
  USING (status = 'live');

-- restaurants: service_role has unrestricted access
CREATE POLICY "Service role full access on restaurants"
  ON restaurants
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- submissions: anyone can insert (the public suggest-a-spot form)
CREATE POLICY "Anyone can submit a suggestion"
  ON submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- submissions: service_role has unrestricted access (curator review)
CREATE POLICY "Service role full access on submissions"
  ON submissions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

- [ ] **Step 4: Run the full test suite — expect all 10 to pass**

```bash
pnpm test
```

Expected:
```
✓ tests/i18n.test.ts (2)
✓ tests/supabase-client.test.ts (2)
✓ tests/schema.test.ts (10)

Test Files  3 passed (3)
Tests  14 passed (14)
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260421000001_rls_policies.sql tests/schema.test.ts
git commit -m "feat: add RLS policies for restaurants (public read) and submissions (public insert)"
```

---

## Task 9: Apply migrations to Supabase + verify

- [ ] **Step 1: Push both migrations**

```bash
pnpm dlx supabase db push
```

Expected:
```
Applying migration 20260421000000_initial_schema.sql...
Applying migration 20260421000001_rls_policies.sql...
Finished supabase db push.
```

If prompted for a database password, use the one from Supabase Dashboard → Settings → Database.

- [ ] **Step 2: Verify tables in the dashboard**

Open Supabase Dashboard → Table Editor. Confirm `restaurants` and `submissions` tables appear.

- [ ] **Step 3: Verify RLS policies**

In Supabase Dashboard → Authentication → Policies. Confirm:
- `restaurants` shows 2 policies
- `submissions` shows 2 policies

- [ ] **Step 4: Quick SQL smoke test**

In Supabase Dashboard → SQL Editor:

```sql
-- Insert a draft row
INSERT INTO restaurants (slug, name_ko, address_ko, lat, lng, cuisine)
VALUES ('test-smoke', '테스트', '서울특별시 용산구', 37.5326, 126.9903, 'mexican');

-- Verify it's there with draft status
SELECT slug, status, name_ko FROM restaurants WHERE slug = 'test-smoke';

-- Clean up
DELETE FROM restaurants WHERE slug = 'test-smoke';
```

Expected: SELECT returns 1 row with `status = draft`. DELETE succeeds.

No new commit needed — this task is verification only.

---

## Task 10: Deploy to Vercel

- [ ] **Step 1: Initialise Vercel project** (from inside `taco-tracker/`)

```bash
vercel
```

When prompted:
- Set up and deploy: **Y**
- Scope: your personal account
- Link to existing project: **N**
- Project name: `taco-tracker-korea`
- Directory: `./`

Accept detected settings (Next.js).

- [ ] **Step 2: Add environment variables**

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
# Paste URL, press Enter, select: Production, Preview, Development

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# Paste anon key, select: Production, Preview, Development

vercel env add SUPABASE_SERVICE_ROLE_KEY
# Paste service role key, select: Production only
```

- [ ] **Step 3: Deploy to production**

```bash
vercel --prod
```

Expected: build succeeds, outputs a live URL like `https://taco-tracker-korea.vercel.app`.

- [ ] **Step 4: Verify the live site**

Visit the Vercel URL:
- `/` → Korean heading "서울의 타코 & 멕시코 음식" on cream background
- `/en` → English heading "Tacos & Mexican Food in Seoul"
- No console errors in browser DevTools

- [ ] **Step 5: Commit the Vercel project link**

```bash
git add .vercel/project.json
git commit -m "chore: link Vercel project for taco-tracker-korea"
```

---

## Self-Review Checklist

**Spec coverage (from docs/architecture.md and docs/schema.md):**
- [x] Next.js 15 App Router on Vercel — Tasks 1, 10
- [x] Tailwind v4 + design tokens from design-rules.md — Task 2
- [x] Pretendard + Fraunces fonts — Task 2
- [x] next-intl ko/en, Korean default — Task 3
- [x] Supabase server + browser clients — Task 5
- [x] All columns from schema.md restaurants table, including dietary flags + photo alt text + ip hash — Task 7
- [x] All columns from schema.md submissions table — Task 7
- [x] Indexes from schema.md — Task 7
- [x] RLS policies from schema.md — Task 8
- [x] Migrations applied and verified — Task 9
- [x] Deployed with all three env vars — Task 10
- [x] Kakao env vars (REST + JS keys) — deferred to Part 2 as planned
- [x] Vitest passing throughout — Tasks 4, 5, 7, 8

**Not in this plan (correct — deferred to later parts):**
- Kakao Maps JS SDK and seeding script (Part 2)
- Map page, filters, listing components (Part 3)
- /suggest form, /about, analytics, Lighthouse (Part 4)
