# Examio Game Reports Implementation Plan

> **For agentic workers:** Use test-driven development and isolated local changes only.

**Goal:** Durable private history of completed live games.
**Architecture:** Snapshot on final podium transition; owner-scoped persistence with existing auth/same-origin guards. Client integrates a separately styled module into the existing library.
**Tech Stack:** Node.js, Express, Postgres, browser JS/CSS.
**Spec:** ../specs/2026-11-15-examio-game-reports-design.md

- [x] Backend: fail first with synthetic completed/abandoned game tests; preserve accurate ties and unanswered counts; test persistence/retention, auth and delete isolation.
- [x] Frontend: fail first with collapsed report list and select/delete tests; render real tabs with safe text and error handling.
- [x] Integrate and verify schema lifecycle, privacy, and regression suite with synthetic fixtures.
