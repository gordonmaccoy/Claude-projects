# OnScreen V2 — Development

Private professor workspace with Google/email sign-in, a saved test library, live classroom sessions and persistent results. Students join by QR with a student number and name; the separate public display receives names/status only.

See [V2_SETUP.md](V2_SETUP.md) for Railway Development and authentication configuration, verification and limitations. Do not deploy this branch to production.

## Local development

Use Node 22 or later. Configure `DATABASE_URL` for a disposable PostgreSQL database and the auth variables described in the setup guide, then:

```sh
npm ci
npm run build
npm test
npm run check
npm start
```

Professor: `http://localhost:3100/professor.html`. Build output is committed so `npm ci --omit=dev` can run the app without the build tool.

`npm run test:ui` exercises the real professor/student pages with local PostgreSQL (PGlite) and a simulated auth provider. It needs Chrome on Windows, a Playwright Chromium installation elsewhere, or `CHROME_BIN` pointing to a Chrome executable. Live Google OAuth and email delivery require configured external credentials and a separate manual acceptance check.

## Workflow

1. Sign in, open Library and create a multiple-choice test. Select the correct choice for each question and save.
2. Launch a saved test, or use Open classroom display in the Classroom calculator card. The classroom popup opens separately; move it to the projector. Use Open classroom display if popups are blocked. Click its QR to expand/minimize.
3. Students enter their student number and name. Test questions remain hidden in the waiting room until Start test.
4. The private dashboard shows monitoring events, live grades, raw grades and FAIL overrides with reasons. Students see their own effective score and percentage immediately after submission.
5. Results stores prior tests and exports `.xlsx` files sorted naturally by student number, with text identifiers and exactly four columns: student number, student name, absolute score, percentage (0–100).

A confirmed continuous hidden interval **strictly longer than five seconds** after test start produces a durable FAIL and effective score zero. Network loss alone turns the roster red without failing the student. Returning after FAIL does not restore the grade; a professor override does. Submitted students do not accrue new failures. The raw grade and incident history remain available privately.

Sessions survive professor disconnection and server restart. Student enrollment and drafts resume using a private capability stored before joining. Keep the same browser; do not clear its storage. If storage is blocked, reconnection works while the page remains open, but recovery after closing/reloading cannot be guaranteed.

Completed test results can be deleted from Results after confirmation; the saved library test is kept. Calculator sessions are visibility-only, have no score/export, and never appear as saved results.

The classroom window is reused on reopen and across sessions, including after a professor-page refresh. If the browser blocks an automatic popup on a slow launch, the Open classroom display control provides a direct retry.

## Scope and limits

This is a page-visibility monitor, not a lockdown browser. It cannot identify what a student switched to, prove intent, or prevent browser events being spoofed. OS interruptions may hide the page; professors should review the durable event history when overriding.

Use one Development app replica. All mutations are PostgreSQL transactions, but live socket rooms use a single process. No Redis adapter/multi-replica transport is implemented. Test on real student phones before graded use.

Legacy `onscreen_*` tables are retained untouched. V2 uses account-owned `onscreen_v2_tests` and `onscreen_v2_sessions`. Legacy records are not silently assigned to whichever professor signs in first; see the setup guide for migration considerations.

## Roadmap — not implemented

AI-assisted multiple-choice creation from pasted source text: choose question count/difficulty, generate source-grounded questions, review/edit answers, then save to Library. Mandatory professor approval and source evidence are planned. No AI generation code, API, key or charge is part of V2.
