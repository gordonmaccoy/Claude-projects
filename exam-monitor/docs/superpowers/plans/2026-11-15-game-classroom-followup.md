# Examio Game Classroom Follow-up Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development and test-driven development. Steps use checkbox syntax.

**Goal:** Apply approved Development-only classroom usability and presentation polish.
**Architecture:** Preserve the static frontend and authoritative Express game session. Integrate focused patches for timing/presentation, professor controls, asset rendering, and server lobby/picker.
**Tech Stack:** Node, Express, PostgreSQL/memory store, vanilla JS/CSS, Web Audio, Pillow.
**Spec:** ../specs/2026-11-15-game-classroom-followup-design.md

## Global Constraints
No remote writes or deployments; fake data only. Preserve graded tests, game scoring, library copies and token-based recovery. No new dependencies.

## Review Focus
Concurrent same-avatar choice, 31st/51st player, old sessions/resume, hidden-tab score catches up, two sessions' host controls stay separate, popup blocked, student view does not leak roster.

### Task 1: Enrollment, room-name resolution and picker
- [ ] Add tests for strict Large class persistence and 30/50 valid ranges, serialized claims, correct rejoin, and disjoint game vs graded room routes.
- [ ] Observe failures.
- [ ] Implement in game.js, game-store.js, game-routes.js, landing.js and game-player.js/html. Common contract: saved game field `largeClass` boolean, joinable lobby state returns `largeClass` plus `takenAvatarIds`, host/display states include `roomName`. Existing guided PIN join unchanged.
- [ ] Rerun tests, include the canceled preview and both pages, confirm no off-page assets on phone.
- [ ] Commit.

### Task 2: Inline host and projector lobby
- [ ] Add a regression proving game Launch opens the classroom only and controls stay on Game Library.
- [ ] Observe failure.
- [ ] Extend game-library.js/html, game-host.js and a focused stylesheet. Game draft persists `largeClass`; clone the host controls in place; use ordinary Examio professor theme. Implement QR-right and name-centered projector lobby using separate CSS or JS to minimize file coupling.
- [ ] Verify top-down workflow, blocked popup, inline refresh, existing links and theme isolation.
- [ ] Commit.

### Task 3: Coordinated score, audio, and podium
- [ ] Add server and fake-clock client regressions for score withholding, shared 1020 ms start, catch-up, and sequence; add vote styling/contrast checks.
- [ ] Observe failure.
- [ ] Extend game.js, game-client.js, game-display.js, game-audio.js, game-stage.css. Schedule score/podium with server timestamps; use existing score formula. Do not add new API capabilities.
- [ ] Verify presentation under reduced motion, color/contrast, staggered polls, final rank, and short podium.
- [ ] Commit.

### Task 4: Original avatar artwork and high-quality animation
- [ ] Write validation for 50 named/unique usable assets, dimensions, still/animation rendering and picker thumbnail contrast.
- [ ] Observe failure.
- [ ] Add 14 original matching characters and explicit thumbnail and feature-animation selectors for all 50 in game-avatars.js; keep legacy ids 1–36. Use game avatar asset manifest consumed by picker/presentation, never preload high-res set. Confirm animation/art render points: player preview, result, podium.
- [ ] Run tests and inspect contact sheet and animated samples.
- [ ] Commit.

### Task 5: Integrate and verify
- [ ] Run npm run check, npm run build and focused game tests, then npm test.
- [ ] Run synthetic multi-browser/controller flow if browser is available; report exact blockers otherwise.
- [ ] Keep branch unpublished unless release comes separately.
