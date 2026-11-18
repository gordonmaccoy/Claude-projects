# Examio Motion Tours Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Produce five caption-only walkthroughs in landscape and vertical formats and replace the old tour with a video library.

**Architecture:** Record deterministic local demo states using existing Playwright/PGlite infrastructure. A scene manifest supplies screenshots, caption timing, focus regions and click positions to an offline motion compositor; encoded MP4s are played through a lightweight existing-site dialog.

**Tech Stack:** Node.js, Playwright, PGlite, browser canvas or HTML composition, FFmpeg H.264 encoder (locate/install production tool if absent), native HTML video.

**Spec:** ../specs/2026-11-18-motion-tours-design.md

## Global constraints
- Five tours: launch, monitoring, create, results, games.
- Caption-only; fictional data; no live accounts or external messages.
- 1920×1080 landscape and 1080×1920 vertical MP4, 30fps, yuv420p, faststart.
- Verify current app behavior; no fabricated features.
- Do not publish the replacement until all five videos pass playback checks.

## Review focus
- Portrait captions and UI details remain legible inside social-media safe margins.
- Hidden-page fail only occurs with the relevant setting enabled.
- Closing a tour stops playback and restores focus.
- Missing media has a helpful transcript and retry/download fallback.
- Old onboarding dismissal remains compatible and opening tours does not create sessions.

## Task 1: Capture current demonstration flows
**Files:** create scripts/capture-motion-tours.cjs; reuse patterns from scripts/capture-product.cjs, scripts/capture-monitoring.cjs and test/capture-tour.js; output ignored output/motion-tours/captures/.
**Interface:** capture writes manifest entries {tour,scene,image,focus:{x,y,w,h},click:{x,y}} in normalized coordinates.
- [x] Seed disposable teacher, quizzes, students, completed/live results and games, using actual application APIs and model functions.
- [x] Capture each approved sequence through the real UI, including Quick Launch, corrections, real-time answers and both game modes.
- [x] Assert target controls and expected statuses before saving each frame; inspect images for clipping and personal data.

## Task 2: Compose and render ten videos
**Files:** create scripts/motion-tours/scenes.json, scripts/render-motion-tours.cjs; output output/motion-tours/{landscape,vertical}/.
**Interface:** scene entries {tour,image,caption,duration,focus,click}; renderer accepts --format landscape|vertical and --tour ID.
- [x] Author short captions with sufficient reading time and different scene selections for vertical cutdowns.
- [x] Implement smooth camera motion and click rings without moving captions; use Examio branding and consistent opening/closing frames.
- [x] Render Launch first, inspect full playback; apply established style to remaining four.
- [x] Probe all ten outputs for dimensions, frame rate, duration and playable encoding; inspect transitions, final frames and caption safe areas.

## Task 3: Replace current tour
**Files:** modify public/tour.js, public/professor.html and existing tour CSS; create public/tour/videos.json and transcript assets; place optimized landscape media in deployable static assets only after checking file sizes and repository hosting limits.
**Interface:** preserve createOnScreenTour(api) return {offer(state),reset()}, extend open(tourId) for contextual links.
- [x] Add browser checks for five choices, native controls, closing pauses video, focus restoration, keyboard interaction and missing-media fallback.
- [x] Replace screenshot controls with a responsive video library, transcript and relevant-section entry points; preserve dismissal API and reset behavior.
- [x] Run npm run check and affected browser/integration checks, then full regression suite if integration changes require it.
- [x] Review desktop/mobile in both themes; publish through the authorized Public deployment only after videos and UI pass checks.

## Task 4: Deliver
- [x] Provide five landscape and five vertical downloadable MP4s, captions/transcripts and production manifest for later updates.
- [ ] Confirm deployed tour assets load and play, and distinguish any unpublished items explicitly.

Implementation verification: 389 regression tests passed; dedicated player and integrated onboarding browser checks passed; all ten MP4s fully decoded and played in Chrome. Delivery ZIP and gallery created. Public deployment pending.
