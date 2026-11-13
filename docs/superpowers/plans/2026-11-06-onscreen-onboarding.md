# OnScreen Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A durable first-login tour and independent two-question starter test.
**Architecture:** Transactional per-owner PostgreSQL onboarding state, authenticated initialization/dismissal API, and an accessible explanatory dialog in the existing professor workspace.
**Tech Stack:** Existing Express, PostgreSQL, plain browser JavaScript, PGlite and Playwright.
**Spec:** ../specs/2026-11-06-onscreen-first-login-design.md

## Global Constraints
- Development only; use existing onscreen/test-mode-hardening branch as requested.
- No dependency or Supabase auth changes. No modification of existing tests, sessions, or results.
- Two factual one-point questions; each new professor gets private independent IDs.

## Review Focus
- Concurrent initialization must create one starter copy: repository concurrency test.
- Deleted starter and existing users with empty libraries must not reseed: durable state tests.
- Token refresh/account switch must not reopen a dismissed tour or leak state: UI reload/replay tests and generation guards.
- Escape, mobile layout, focus and failed persistence must keep the tour usable: browser dialog tests.
- Tour must never launch an exam, change active sessions, or send material to AI: browser assertions on session count and draft preservation.

### Task 1: Persistent setup
Files: create exam-monitor/onboarding.js; modify store.js, server.js; test test/onboarding.test.js.
- [x] Add failing repository/API tests for new/existing users, ownership, dismissal, restart and concurrent initialization.
- [x] Run tests and observe failure.
- [x] Implement createStarterTest(), initializeOnboarding(ownerId, starter), dismissOnboarding(ownerId), POST /api/onboarding and POST /api/onboarding/dismiss. A new owner metadata row serializes initialization; seed and metadata commit together. Treat any prior session (including deleted) as existing use.
- [x] Verify tests green.

### Task 2: Walkthrough
Files: public/professor.html, professor.js, professor.css; test/browser-smoke.js.
- [x] Add failing browser assertions for first tour, skip/reload, all five steps, mobile layout, replay focus and no side effects.
- [x] Implement five-step modal, persistent skip/finish, Take tour replay; initialize after identity verification and before refresh, protect with account generation and in-session seen flag. Escape persists dismissal, failures remain retryable in the dialog.
- [x] Verify browser assertions and full existing functionality.

### Task 3: Finish
- [x] Independent whole-change review, one fix pass for material findings.
- [x] Run build, check, unit/API and browser tests; document configuration (none).
- [x] Commit/push existing Development branch, verify Railway Development health and served assets; live replay verification without creating any real session.

## Ledger
- Ruling: continue inline on the explicitly requested development branch, following the established session workflow; user approved implementation, so no extra execution-method/worktree approval.

- Independent review: no critical or important findings. Minor limitation recorded: PGlite uses a single leased connection, so overlapping initialization requests exercise idempotency but not real PostgreSQL lock contention. Production SQL serializes on the unique owner key within a transaction.
- Browser RED: missing tour dialog; GREEN: first login, independent starter, failed persistence retry/Escape, dismissal after reload, five steps/Back/replay, mobile width, focus restoration, draft preservation, account switch, and existing folder deletion retaining tests. Bob fixture now dismisses its own first-login tour before prior privacy assertions.
- User added folder-delete menu request: renamed the existing Edit folders disclosure to Manage folders and explained that tests are retained in Uncategorized Test. Existing deletion regression covers this.
- Verification: build/check and all 34 unit/API tests passed; full browser smoke passed. One earlier full run hit the pre-existing intermittent Windows PDF-worker process failure; isolated PDF checks and the final full suite passed without PDF code changes.

- Deployed dfd4c1e to Railway Development (success). Live health 200 and professor.html/professor.js/tour.js match committed content. Live Google sign-in, existing-account library preservation, replay/dismiss with focus restored, and Manage folders Rename/Delete controls verified without launching exams or deleting user data. Screenshot evidence saved in ignored .tmp/onscreen-v2/live-onboarding.png and live-manage-folders.png. No configuration required; production untouched.
