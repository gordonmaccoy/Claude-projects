# OnScreen classroom locks and authoring implementation

**Goal:** Deliver the user's classroom lock, mixed-question, organization and two-import-flow changes on Development.
**Architecture:** Extend the current Express/Socket.IO/PostgreSQL application. Preserve legacy MC question compatibility and immutable launch snapshots. Local document extraction is separate from optional server-side OpenAI generation.
**Spec:** ../specs/2026-11-06-onscreen-classroom-authoring-design.md
**Constraints:** Existing development branch/PR only. No production deployment. Excel retains exactly its current four columns. Student numbers never public. Confirmed hidden time, not network loss, triggers failure.

## Tasks and interfaces

1. Monitoring: `exam.js` numeric validation, both-mode `sweep`, locked write rejection, durable `override`, submitted terminal state. Update `server.js` mutation wrapper to commit a sweep even when rejecting a locked action. Tests: strict boundary, calculator lock, unlock, draft retention, locked submit/draft, terminal submission and unchanged export.
2. Mixed questions: `validateTest` accepts legacy MC and `{type:'blank',acceptedAnswers:string[],caseSensitive:boolean}`. `validateAnswers` accepts bounded text for blanks. `scoreAnswers` grades all questions. Student views whitelist type/prompt/options only. Tests: alternatives/case/whitespace, answer-key privacy and mixed export.
3. Organization: `store.js` additive account-owned folder table with list/create/get; library tests retain `folderId`. Save verifies folder ownership. PATCH completed session label only; original snapshot title unchanged. Tests: restart/ownership, folder assignment, rename isolation.
4. Import: `documents.js` bounded PDF/DOCX extraction and structured existing-test parser; `generation.js` OpenAI Responses structured-output generation with required configured key/model, count/type/difficulty limits and source evidence. `/api/import` and `/api/generate` are authenticated, in-memory uploads, bounded/per-user limited, return editable preview only. Tests use real document fixtures and fake external fetch at provider boundary; no live paid calls.
5. UI: numeric join, blocking Call professor overlay, calculator keyboard lock and unlocked draft restoration; public failed/submitted states. Builder supports types, accepted answers, drag/up/down ordering. Library folders and separate Upload a test/Create with AI previews. Launch expandable folders. Results Rename. Browser tests cover all flows and retain popup/account privacy regressions.
6. Verify clean install/build/full tests/browser; independent review; fix material issues; document AI configuration; commit/push development and verify deployed assets/health.

## Review focus
- Concurrent submit at failure boundary must not bypass a lock or lose durable failure.
- Submitted users never acquire later failures or hidden incidents.
- Imports never save/launch automatically, infer missing keys, retain raw uploads or leak keys to students.
- Folder/result mutations enforce owner and state checks.
- Existing question IDs, grading, leading-zero IDs and exports remain compatible.

## Ledger
- User clarified both import modes as separate options; design updated accordingly.
- Builder-check found no unresolved material choices after that clarification.
- AI service uses environment-configured OpenAI key/model; no live AI request will run until configured. Uploaded ready-made tests use local extraction/parser with answer-key review.

- Tasks 1–4 complete: domain/SQL/API/import tests pass (15/15), including numeric IDs, both-mode locks, submitted terminal state, mixed grading privacy, folder ownership/recovery, result rename isolation, real PDF/DOCX extraction and simulated OpenAI Responses boundary.
- Task 5 complete: browser acceptance passes for numeric validity, MC+blank grade, drag/up/down ordering, class folder selection, public FAIL/submitted, test and calculator unlock, calculator reload recovery, rename, PDF import preview, AI source review preview, unchanged Excel and prior popup/account isolation.
- Task 6 verification: clean npm ci, build, syntax checks, full test suite and expanded browser suite pass; npm audit reports zero vulnerabilities. No live AI request run.
- Final fresh-context review delivered three findings before reviewer hit its usage limit. No second reviewer was dispatched. Boundary double-sweep race and calculator reload loss were Important; valid large drafts being rejected was regraded Important because it prevents saving supported authoring input.
- Final: fixed double-sweep boundary race — forced guard at exactly 5000 ms / inner default at 5001 ms produced 0 successful submissions before fix; single transaction time restores exactly one successful concurrent submit. RED→GREEN, suite 15/15.
- Final: fixed calculator reload work loss — browser expected expression 7 while locked after reload, observed 0 before fix; session-specific local recovery preserves 7 after reload/unlock. RED→GREEN, browser suite passed.
- Final: fixed large valid draft save failure — valid 100-question 211 KB request returned 413 before fix, 200 after bounded 1 MB JSON limit. RED→GREEN, suite 15/15.
- No deferred review minors. No new product-scope rulings. AI key/model configuration remains user-required in Railway Development only.
