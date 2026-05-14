# Taco Map — Design Rules

_Last updated: 2026-04-21_

## Vibe

Warm, editorial, confident — like a food magazine that happens to be a map. Draws inspiration from [The Guinness Map](https://www.theguinnessmap.com/) (cream-and-black editorial calm) and applies it to a Mexican palette. **Never kitschy.** No sombreros, moustaches, "¡amigos!", or cartoon tacos. This product is about the food, not the costume.

## Color Tokens

Defined as CSS custom properties and mirrored in Tailwind config.

| Token | Hex | Role |
|---|---|---|
| `--color-bg` Masa Cream | `#F7F2E8` | Primary background |
| `--color-surface` Pure Cream | `#FFFBF2` | Cards, modals, raised surfaces |
| `--color-ink` Charcoal | `#1B1916` | Body text, headlines |
| `--color-muted` Warm Stone | `#8A8177` | Secondary text, borders, placeholder |
| `--color-brand` Terracotta | `#C84B2F` | Brand accent, primary buttons, active map pins |
| `--color-brand-deep` Mole Brown | `#3B2A1F` | Heading accents, pin shadows, deep hover states |
| `--color-accent` Lime | `#7A9F3A` | Used sparingly — success states, future vegetarian/vegan flags |

**Contrast rule:** every foreground/background pair must pass WCAG 2.2 AA (4.5:1 for body text, 3:1 for large text and UI components). Verify with a tool (e.g. Stark, axe) before shipping any new combination. Token names use the `--color-*` prefix to align with Tailwind v4 color utility requirements.

## Typography

- **Korean (primary):** [Pretendard](https://github.com/orioncactus/pretendard) across all UI — clean, modern sans-serif, designed for KO/EN mixed text. Used for headlines and body.
- **English display (headlines only):** [Fraunces](https://fonts.google.com/specimen/Fraunces) — a warm modern serif with editorial weight. Used on EN pages for H1/H2 where we want magazine feel. Fall back to Pretendard on KO pages (serif Hangul is hard to pair well).
- **English body:** Pretendard. No font swap for body copy.
- **Scale:** `12 / 14 / 16 / 18 / 24 / 32 / 48` px. Default body `16` / line-height `1.55`.
- **Weights:** Pretendard 400 / 500 / 700. Fraunces 500 / 700.
- **Letter-spacing:** Default `0`. Tighten headlines to `-0.01em` at 32px+.

## Voice & Tone

- Warm, specific, confident. Write like a friend who ate there last week — in both languages.
- Korean copy is authored first, English is a peer. No placeholder EN strings like "(KO only)" in production.
- **No emoji in UI chrome** (navigation, buttons, filters, forms). Emoji in curator notes is allowed but should be rare and deliberate.
- No cliché Mexican-restaurant tropes. Describe the food, the room, the people — not the stereotype.
- Curator notes: under 280 characters. Lead with the thing that matters (dish, vibe, warning). End strong. Assume the reader is about to decide whether to go.
- Error messages: short, specific, non-apologetic. "No restaurants match these filters." not "Oops! We're sorry but..."

## Imagery

- **Real photos only.** No stock images, no illustrated tacos. If a restaurant has no usable photo yet, leave the hero empty with a neutral placeholder — never a cartoon.
- **Aspect ratios:** 3:2 for listing cards, 16:9 for detail hero. Crop in CMS/edit time, not in CSS.
- **Treatment:** natural color with a slight warm bias. Avoid heavy filters, vignettes, or stylized grading.
- **Pins:** minimal vector — a teardrop map pin in terracotta with a mole-brown outline, point anchored at the lat/lng. Active pin inverts to cream fill with terracotta outline. When a restaurant has a curator rating, the rating number appears in cream centered inside the pin (Phase 2). Cluster bubbles in terracotta with cream numerals.

## Component Conventions

- **Corner radius:** `md` = 8px (cards, inputs, buttons), `lg` = 16px (modals, large surfaces). Tag chips are pill-shaped. Nothing else is.
- **Shadow:** one elevation, `0 2px 8px rgba(27, 25, 22, 0.08)`. Applied to cards and modals only. Map pins use a dedicated drop shadow integrated into the SVG.
- **Spacing scale (px):** `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64`. Compose from these; no ad-hoc values.
- **Buttons:**
  - `primary` — filled terracotta, cream text
  - `secondary` — ink outline, cream fill, ink text
  - `ghost` — no border, ink text, hover adds cream surface
  - No gradient fills, ever.
- **Tag chips:** pill shape, cream fill, ink border, ink text. Active state: terracotta fill, cream text.
- **Inputs:** 8px radius, ink border at 1px, `--surface` fill, placeholder in `--muted`.
- **Focus states:** 2px terracotta outline, 2px offset, not `outline: none`. Keyboard users are peers.

## Motion

- Subtle only. Default transition 150ms ease-out.
- Map interactions use Kakao SDK defaults.
- No parallax, no hero-scroll animations, no auto-playing video.
- Respect `prefers-reduced-motion` — disable non-essential transitions entirely.

## Accessibility Baseline

- WCAG 2.2 AA across the board.
- Keyboard operability: every interactive element reachable via Tab, visible focus ring.
- Map has a "list view" toggle — the site is fully usable without the map.
- Per-restaurant alt text authored bilingually; no auto-generated alt.
- Landmarks: every page has `<main>`, `<nav>`, `<footer>`. Headings use a sane hierarchy (one H1, logical H2s).
- Tap targets: minimum 44×44 px on mobile.
- `lang` attribute on `<html>` tracks the current locale.
