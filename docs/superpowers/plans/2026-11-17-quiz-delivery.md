# Quiz delivery and Quick Launch implementation plan

Goal: Add the user-confirmed quiz flows, optional student numbers, layout choices, saved Quick Launch options, and native Google Sheets exports.

Confirmed spec (2026-11-17): Free Navigation permits review; Only one attempt locks each confirmed answer in this mode. One & Done! and Teacher Lead deliver one question per page, never backward. Teacher controls Teacher Lead advancement. Immediate Feedback shows the submitted question correction before the next question; otherwise corrections appear after final submission. Every new quiz type shows the final score after submission. Existing sessions keep legacy behavior. Optional student numbers default on; without numbers sort by names. Quick Launch preferences are professor-owned and apply to any selected quiz. Grid/list preference is local to each professor. Drive export requests only drive.file permission and creates a native Sheet from the existing styled XLSX. No automated real grade upload during verification.

Architecture: Add delivery.js for authoritative flow rules; retain row-locked session mutation and existing JSON persistence. Extend existing student/professor interfaces without a framework change. Use existing account profile JSON for saved launch settings, no new database tables. Google export reuses existing Supabase Google OAuth only on explicit connection and uses the returned provider token in browser memory.

- [x] Test server options, question commits/locks, advancement, feedback secrecy, optional identity and export sorting.
- [x] Implement delivery module, integrate exam.js/server.js and owner-scoped preference routes.
- [x] Add horizontal launch type controls, grid/list, Quick Launch and professor advancement.
- [x] Add single-question student delivery, immutable commits, per-question feedback and final submission.
- [x] Add optional-number result layouts/export ordering and Google Drive native-Sheets path with consent/retry UX.
- [ ] Run model/API/browser tests including reloads, pause/timer/failure, duplicate clicks and legacy sessions. Review complete diff, commit, publish Public only, verify deployment.

Review focus: old session compatibility; no future questions/keys leaked; duplicate answer commits idempotent; teacher advancement cannot overwrite submitted answers; optional-number duplicate names cannot merge results; Drive cancellation/account switch must not upload student data.

Verification ledger: 146 model/API regressions passed before provider-token hardening; storage-specific regressions also pass. Real local browser checks cover professor layout, saved Quick Launch, Teacher Lead advancement, each delivery mode, mobile feedback, reload recovery, final score, and name-only result columns. Review found empty skipped Teacher Lead drafts and detailed-number column issues; both fixed and regression checked. Google provider tokens now remain in memory via the auth storage adapter. Real Google consent/upload still requires the documented Cloud API setup; no real grades sent.

Integrated release verification: rebased onto b1b6ffe (Game Reports/unified workspace), preserved its Game Library, report deletion copy, scripts and translations. All 337 quiz/game model/API tests passed; professor/student delivery browser checks passed after integration. Drive API enabled in Examio Public and verified through its Enabled status. Final Public deployment is verified after pushing the prepared release.
