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

1. Sign in, open Library and create a multiple-choice / fill-in-the-blank test. Set correct choices or accepted answers, reorder questions and save in a class folder.
2. Launch a saved test, or use Open classroom display in the Classroom calculator card. The classroom popup opens separately; move it to the projector. Use Open classroom display if popups are blocked. Click its QR to expand/minimize.
3. Students enter their student number and name. Test questions remain hidden in the waiting room until Start test.
4. The private dashboard shows monitoring events, live grades, raw grades and FAIL overrides with reasons. Students see their own effective score and percentage immediately after submission.
5. Results stores prior tests and exports `.xlsx` files sorted naturally by student number, with text identifiers and exactly four columns: student number, student name, absolute score, percentage (0–100).

A confirmed continuous hidden interval **strictly longer than five seconds** during a running calculator or test produces a durable FAIL and locks the activity with “Call professor”. Network loss alone turns the roster red without failing the student. Returning after FAIL keeps the lock; a professor unlock with a reason permits continuation and preserves work. Submitted students do not accrue new failures. The raw grade and incident history remain available privately.

Sessions survive professor disconnection and server restart. Student enrollment and drafts resume using a private capability stored before joining. Keep the same browser; do not clear its storage. If storage is blocked, reconnection works while the page remains open, but recovery after closing/reloading cannot be guaranteed.

Completed test results can be deleted from Results after confirmation; the saved library test is kept. Calculator sessions are visibility-only, have no score/export, and never appear as saved results.

The classroom window is reused on reopen and across sessions, including after a professor-page refresh. If the browser blocks an automatic popup on a slow launch, the Open classroom display control provides a direct retry.

## Scope and limits

This is a page-visibility monitor, not a lockdown browser. It cannot identify what a student switched to, prove intent, or prevent browser events being spoofed. OS interruptions may hide the page; professors should review the durable event history when overriding.

Use one Development app replica. All mutations are PostgreSQL transactions, but live socket rooms use a single process. No Redis adapter/multi-replica transport is implemented. Test on real student phones before graded use.

Legacy `onscreen_*` tables are retained untouched. V2 uses account-owned `onscreen_v2_tests` and `onscreen_v2_sessions`. Legacy records are not silently assigned to whichever professor signs in first; see the setup guide for migration considerations.

## Roadmap — not implemented

Library has separate “Upload a test” (text-based PDF/DOCX with supplied answer key) and “Create with AI” (source material) flows. Both produce editable drafts for professor review before saving. AI requires server-only OPENAI_API_KEY and OPENAI_MODEL on Railway Development; live generation remains unverified until configured. See V2_SETUP.md for format and limits.

Library creation now starts with manual/upload/AI choices, supports folder editing, copying and weighted points. Launch supports optional class deadlines, score visibility and stable answer shuffling. See V2_SETUP.md for limits and timer/draft behavior.

### Sharing quizzes (in-app only)

Saved quizzes can be shared with an existing Examio account by email. The recipient
must open/sign into Examio before sending so the private server-side directory has
seen their verified email. There is no public account lookup or email notification.
For privacy, submission returns the same receipt for unavailable addresses; requests
sent before an account is eligible must be sent again, and never activate for a later signup.

Recipients use **Shared with me** to accept into their own class folder or decline.
An acceptance atomically creates one independent copy containing quiz content,
images and answer keys, never grades, sessions or student responses. Pending requests
can be canceled; accepted copies cannot be remotely revoked. Requests expire after
seven days. Expired/completed snapshots are cleared; request receipts become eligible for deletion
after 37 days and are cleaned on the next sharing activity. Account deletion removes related
requests and directory entries. Browser privacy cleanup also clears sharing UI.

Sharing is limited to 20 attempts per sender/hour and five requests per
sender/recipient/day. The database tables use server-owner access only with RLS
and no client policies; these tables are not intended for direct Supabase Data API use.
The existing one-replica server architecture is unchanged.

Run `node --test test/sharing*.test.js` for persistence, HTTP and UI-controller tests.
