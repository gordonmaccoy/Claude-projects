# Personal Sharing Contacts Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task by task.

**Goal:** Add a private searchable address book to quiz sharing.
**Architecture:** Persist owner-scoped contacts in PostgreSQL using the existing account transaction wrapper. Add authenticated CRUD endpoints and a focused browser controller in the existing Share dialog. Remember recipients within the sharing transaction without exposing account existence.
**Tech Stack:** Express, PostgreSQL, vanilla JavaScript, Node tests, PGlite, browser checks.
**Spec:** ../specs/2026-11-14-personal-sharing-contacts.md

## Global constraints
Private per professor; no directory or account-existence badges. Retain direct email entry, generic sharing receipts, and current quiz acceptance rules. Delete contacts with their owner. English/Korean UI, mobile layout, no new dependencies.

## Review focus
Foreign IDs; duplicate normalized emails; stale browser responses after logout; a failed contact request must not prevent direct sharing; remembering a recipient must not overwrite an existing name.

## Tasks
- [ ] Write failing persistence and API tests for CRUD, deduplication, isolation, validation, remembered recipients and deletion cleanup.
- [ ] Implement sharing contact table/methods in sharing-store.js, account cleanup and authenticated /sharing-contacts routes in server.js.
- [ ] Write browser/controller tests; implement contact picker, search, add/edit/remove controls and translations in a focused contacts.js module and professor.html/CSS.
- [ ] Run regression tests and build, review changes, verify browser interactions, commit and deploy Public; check live health and contact picker.
