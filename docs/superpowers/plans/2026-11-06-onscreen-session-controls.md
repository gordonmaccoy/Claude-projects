# Session controls and embedded-browser compatibility

User requirements are concrete; extend existing Development implementation. Root causes: native prompt() is unsupported in embedded browser, ended current dashboard is retained, result rename restricted to ended state, no terminal professor fail action or question progress.

1. Test native prompt disabled; replace folder/name/reason entry with an accessible in-app modal form. Keep validation/errors in the form. Cancel sends no mutation.
2. Allow owner to rename a launched test waiting/running/ended, retain immutable library snapshot, use session label for public/student/private/results/export filename.
3. Add owner-only Submit Fail score for unsubmitted failed test enrollment (including an ended session). Save server draft original score/audit, final zero and terminal enrollment; notify then disconnect student, final result survives resume. Calculator remains ungraded.
4. Track focused/visible current question and answered count privately; validate IDs, no progress after failure/final submission, public payload stays names/status only.
5. Launch heading Choose a test to launch, fallback Uncategorized Test, Tests In Session with only open sessions; clear ended dashboard and active section when none.
6. Tests first, domain/API/browser regression checks, independent final review, commit/push existing development branch and verify Railway Development assets/health. No production action.

## Ledger
- No unresolved product choices. Progress means question currently focused/viewed plus answered count; no answer content in professor progress or public display.

- Root causes reproduced: browser suite with window.prompt throwing failed New class folder; domain tests lacked finalizeFail/progress; owner rename during waiting returned409; ended dashboard remained visible.
- Domain/API checks now cover terminal professor fail at0% with original grade, failed-state/owner validation, final score resume, disconnected socket, progress ID validation/privacy, live-session label isolation and Unicode export filename.
- Independent review found stale unlock could reverse finalized0, missing visible-question progress, and stale active list after another tab ends a session. Regraded stale active list Important because closed sessions must disappear. No deferred minors.
- Final: fixed stale unlock — regression assertion failed before guard, now professorFinalized submissions reject override inside the locked mutation.
- Final: fixed visible progress — initial-question browser assertion failed before viewport reporting; question with the largest visible portion (at least50px) is reported on render/scroll/resize; focused/clicked question is reported immediately and has priority while visible, until an explicit wheel/touch/scroll-key interaction. A short viewport ensures the scroll regression fully leaves the previous question.
- Final: fixed cross-tab close — browser ended session through another owner HTTP client; active-list-empty assertion timed out before fix. Ended/title/phase socket updates now refresh session lists.
- Import-process check was intermittent under concurrent local runs, without a useful native error; unchanged import module passed five isolated runs and subsequent full suite. No speculative implementation change made.

- Verification: build and syntax checks pass; all18 automated tests pass. Expanded browser flow passed with prompt() throwing; confirms in-app folder/rename/unlock forms, terminal zero/reload, viewed/focused progress, Unicode-name export, cross-tab close, empty active section and existing privacy/popup regressions.

- Visual verification caught submitted students counted as active. Added browser assertion:0 active after both normal/fail submission; observed failure before filtering completed results from active count.
