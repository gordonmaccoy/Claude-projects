# Cheating deterrents integration plan

Connect the approved launch menu without adding device lockdown or screenshot blocking.

Contract: session `security` stores booleans enabled, inactivityFail, shuffleQuestions, textSelection, copyPaste, fullscreen, tabVisibility, focusVisibility. Student/private views receive effective flags; disabled master means all false and disables answer/question shuffling. Legacy sessions retain existing behavior (no newly introduced fullscreen/focus requests).

- Validate immutable launch settings and enforce them in the authoritative exam state machine. Hidden time alone may fail; focus/fullscreen only log. No monitoring events while waiting, paused, finished or after completion.
- Master off leaves students green and suppresses deterrents/events while allowing answer saving, timer expiry and submission.
- Stable per-student question/answer permutations persist by ID; resumes preserve order. Keep teacher result columns canonical, corrections/progress aligned to student presentation.
- Add authenticated-enrollment socket event for deduplicated allowlisted focus/fullscreen transitions, bounded event history. Hidden heartbeat remains for server failure timing regardless of optional visibility logging.
- Wire professor toggles and disable dependent controls visually under the master switch without forgetting selected values.
- Student client honors flags; fullscreen uses an explicit user gesture and gracefully handles unsupported/denied requests. Selection and clipboard guards release on pause/finish and preserve normal answer entry.
- Unit/API tests cover independent flags, validation, strict failure threshold, paused/terminal suppression, shuffle/grading/resume and privacy. Browser checks cover switch payloads and student guards. Review and verify before Public deployment.

Verification: 88 automated tests pass; rooms browser validates master/dependent switches, persisted flags, joining, grading and submission; polish browser passes existing editor/classroom/results flows. Independent review found no blockers. Fullscreen control moved above activity content for long tests. No screenshot/device lockdown promises. New policies apply to newly launched sessions; legacy sessions retain previous behavior.
