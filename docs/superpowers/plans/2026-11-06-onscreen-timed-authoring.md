# Timed authoring implementation plan

Goal: implement the detailed user request on the existing Development branch, preserving public privacy and Excel columns. Use executing-plans inline, TDD, one final independent review.

Design: retain Express/Socket.IO/PostgreSQL JSON snapshots. Timer is a durable server deadline shared by the class, starting at Start test (questions open), no limit by default. Show scores defaults true; shuffle defaults false and stores stable per-enrollment option IDs/order. Scores use question points (default1, positive up to1000, two decimals), with total points as denominator and legacy defaults. Timer expiry auto-submits latest server drafts, preserving any FAIL at0%, ends session, and cannot be undone by late answers/extensions. Extend adds60 seconds only before expiry and notifies students. Local drafts remain useful for manual submission; deadline grading uses server-acknowledged answers.

1. Domain/grade/timer tests RED, implement exam.js totalPoints, launch settings, per-enrollment shuffle, deadline sweep/autosubmit/extension, hidden student grades. Test strict boundary, failed student at expiry, reload/deadline, extension, stable shuffle, weighted export denominator.
2. Folder rename/delete (keep tests uncategorized) in owned transactions; copy test preserves source. Tests ownership/concurrent-save semantics.
3. Import parser reproduction: current zero-question preview causes first question as title + blank editor. Broaden numbered, unnumbered option-block, inline labels and answer-key formats; never guess keys or open an empty editor. Real PDF/DOCX and pasted text fixtures. User sample requested asynchronously.
4. UI: Library New folder/Create new test + Edit folders menu. Create new test opens manual/upload/AI choice; input name/folder preserved across previews. Builder points. Launch settings modal timer/show score/shuffle; extend control. Student selected-answer-only progress, unanswered confirmation in-page, countdown/1min/10sec/extension notices, hidden-grade receipt and auto result. No scroll/focus progress.
5. API/domain/browser verification, fresh review, fixes RED/GREEN, docs, commit/push existing branch, Railway Development health/assets verification. No production deployment.

Defaults inferred from request: delete folder keeps tests; copy means copy of a test; countdown begins when questions open; unanswered manual submit may proceed after explicit warning; no late extension revives ended test.

## Verification ledger
- Exact supplied10-question sample reproduced failure (1 parsed instead of10). Added fixture and parser support; paste/PDF/DOCX now yield4 blanks and6 multiple-choice questions; unmarked MC keys remain unresolved for review.
- All26 automated tests and the expanded browser flow passed before final clock-ACK check.
- Final independent review: original FAIL grade leaked, volatile clock caused unrelated student broadcasts, conflicting keys silently resolved, and old folder names remained across account switch. The latter two regraded Important: incorrect answer keys affect grades, and folder names are private account data. No deferred minors.
- All4 findings reproduced RED and corrected: explicit student-grade projection; clock timestamp applied after substantive diff and on direct ACKs; conflicting keys unselected with warnings; new folder/menu/input surfaces cleared at sign-out.
- Additional clock ACK regression exposed a missing direct clock sample; fixed to use the same wire projection. Narrow student layout changed to stack the status notice above the test; countdown screenshot checked.
- Timing defaults were inferred from the detailed user request: shared deadline starts when questions open; no timer unless selected; folder deletion keeps tests; manual unanswered submission permitted after explicit confirmation. No paid AI calls or production actions.

- Final build/check/test26/26 and expanded browser suite passed after all fixes, including clock validity across heartbeat, hidden-score expiry/reload, exact sample import, weighted3/3 grading, time extension, folder/copy/account isolation and existing classroom reuse.
