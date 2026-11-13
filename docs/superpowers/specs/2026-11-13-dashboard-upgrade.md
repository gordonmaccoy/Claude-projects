# Dashboard, results and pause upgrade

Implement the user's dashboard refinements on the Public release branch.

- Keep work cards and named navigation/action controls white in blue mode. Selected privacy toggles are blue in light mode and white in blue mode.
- Sticky language/header/tab stack; Take tour scrolls normally. Calculator is a closed details panel below saved tests. Remove sample format link.
- Library folder handles reorder the complete owner-scoped list, persist it, and share ordering with Launch. Existing alphabetical order is the default until changed.
- Open-result toolbar has Summary, Detailed, Rename, context-sensitive Download and right-aligned Delete. Result cards only offer View results. Common statistics count all joined students, completion from finalized attempts, and class average from finalized percentage scores.
- Detailed grid adds submitted-attempt percent-correct per question. Q headings open a question dialog with navigation, optional result percentages, original question content/images and correct/incorrect colors. Distribution counts live answers using option IDs so shuffled answers remain accurate.
- Monitoring event counts above five use red text. Start/end controls are larger.
- Pause/resume is authenticated and owner scoped. User explicitly chose to freeze both countdown and inactivity monitoring. Paused phase, remaining duration and drafts persist. Students receive a lock overlay; submitted attempts remain terminal. Resume restores remaining duration and grants hidden students a new five-second interval. Existing failures stay failed. Class display shows paused status and frozen time.

Verification: dedicated domain/API/socket tests cover pause, owner isolation, reconnect, paused write rejection, folder persistence and order validation. Browser tests cover professor controls/layout/results and student pause lock/resume. Result analysis has focused calculation tests. A read-only final review found no P1/P2 issues. The pre-existing PDF import test process still exits under the full isolated test runner; no parser changes are included.
