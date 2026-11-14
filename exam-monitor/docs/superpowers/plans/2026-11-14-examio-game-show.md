# Examio Game Show Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Each checklist starts with a failing test.

**Goal:** Build the approved teacher-controlled classroom game show.
**Architecture:** Keep authoritative server timing; separate player, projector and teacher views. Animate snapshots with original artwork/audio.
**Tech Stack:** Node, Express, browser JS, CSS, Pillow.
**Spec:** ../specs/2026-11-14-examio-game-show-design.md

## Global constraints
Development only. Do not deploy. No graded tests or scoring formula changes. Five full reading seconds, existing answer duration unchanged. No prompt, choices, answer key or classmates' data in phone payload.

## Review focus
Reading boundary, closed-round retries, scoreboard concealment before Show Scores, repeated polls, five-choice phone viewport, reduced-motion and muted projector.

### 1. Authoritative round/phone API
**Files:** game.js, game-routes.js and relevant domain/HTTP tests.
**Contract:** Existing countdown phase is reading; read starts at startsAt - 5000. Player view question:{slotCount} during question only, answer:{slot} before reveal, add own correct and points at reveal. Submit {questionIndex,slot} with zero-based numeric slot. During reveal player score/rank is prior. Include roundEndReason ('all-answered'|'timeout') and roundEndedAt; leaderboard rows include previousScore/previousRank when shown. Do not emit options in reading even to projector.
- [ ] Red tests for boundary, idempotency without points, masking, early/timeout, prior ranks, private drill.
- [ ] Implement, rerun focused suite; review.

### 2. Round display/score/phone controller
**Files:** public/game-client.js, game-player.js/html, game-classroom-control.js, game-show.js, optional helper, corresponding tests, new public/game-stage.css (root will include in display/host).
**Contract:** Follow Task 1, use shared color/shape slot mapping and existing GameAvatars.image(id). Maintain GameClient.render API. Use authorized relay for Show Scores/Next Question/Show Podium.
- [ ] Red tests for full state flow, shape slots and progression, then implement screen states, chart, score and podium animations.
- [ ] Rerun focused suite; review small viewport, keyboard, and previous-rank row reordering without poll replays.

### 3. Original motion assets
**Files:** public/game-avatars.js, public/game-avatars/*.gif, generator if used, public/game-classroom-backdrop.svg, test/game-avatars.test.js.
**Contract:** GameAvatars.image(id) selects GIF, returns WebP for reduced motion; GameAvatars.still(id) exposes the static grid thumbnail. Preserve original artwork.
- [ ] Red asset tests for 36 loops, reduced-motion lookup and realistic budget.
- [ ] Implement assets and faded backdrop; rerun and review.

### 4. Classroom audio
**Files:** public/game-audio.js, test/game-audio.test.js, public/game-display.js as needed.
- [ ] Red tests for lobby loop, silence during read, randomized question music, one-shot gong, stale/reload no replay.
- [ ] Implement original synth audio with volume/mute/unlock and classroom-only playback; rerun and review.

### 5. Integration
- [ ] Run npm run check, npm run build, npm test, verify exact candidate results.
- [ ] Run npm run test:game-ui using supported browser if available, otherwise report. Synthetic media, 2/4/5 choices, early/timeout, wrong/missing answers, rank reversal and ties, reconnect and authorized next/podium should be covered.
- [ ] Review final diff before delivering candidate; no push/deploy based on build approval.
