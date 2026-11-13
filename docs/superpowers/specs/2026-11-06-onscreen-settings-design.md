# OnScreen settings, account, contact and help

## Intent and decisions
The user requests a Settings button, a professor profile, Sign out/Delete account, Contact us for queries/features, an AI help chatbot, and room for future subscriptions. Supplied screenshots illustrate the account menu/profile layout; they do not supply app behavior or credentials.

User selected an AI chatbot grounded in the OnScreen guide and email delivery to **gordon.maccoy@gmail.com**, configurable later. Continue on onscreen/test-mode-hardening / PR #6, Railway Development only. Never deploy to production or delete the real owner's account during verification.

## Approaches
Recommended builder choice: an account dropdown opening a Settings view inside the existing authenticated professor workspace. It reuses the current auth, responsive styling, status messages, and in-page confirmation controls. A separate settings application adds an unnecessary second login/navigation system. Subscription/payment infrastructure is premature; record it on the roadmap only.

For Help, the user chose a guide-grounded AI conversation over a scripted FAQ chat. Screenshots/interactive Take tour remain accessible alongside the bot.

## Navigation and profile
- Add an accessible Settings button in the professor header, with Profile, Account, Help, Contact us, and Sign out entries. Keyboard/Escape/outside-click behavior and mobile sizing must work.
- Settings uses clear internal sections and Back to workspace. Preserve unsaved test drafts when opening/closing Settings; do not change active sessions.
- Profile: first name, last name, optional school/institution, verified email shown read-only, Save with success/error feedback. Store profile per verified user in Railway PostgreSQL. Names are display data, never authorization claims.
- Keep email/password changes outside this scope; existing password-reset and Google/email sign-in continue to work. Clear profile/contact/chat state on sign-out or account switch.

## Account and deletion
- Sign out uses existing Supabase sign-out and clears private UI/socket state.
- Delete account clearly lists irreversible effects: profile, folders, tests, saved results, contact requests, and the sign-in account are removed. Offer an opportunity to export results first. Require typing DELETE and the signed-in email; do not accept a client-supplied target user ID.
- Require all test and calculator sessions to be ended before deletion. Server enforces this, including concurrent launch/deletion requests.
- Use a dedicated server-only Supabase administrative credential for deleting the verified requesting identity. Never expose it through /api/config, client bundles, logs, screenshots or tests. Missing configuration leaves deletion unavailable with an honest message; never claim deletion succeeded.
- Coordinate PostgreSQL and Supabase with a durable deletion intent and retry/recovery path. Freeze access once deletion starts, prevent concurrent writes/reseeding, purge owned app data, and remove the auth identity. Handle provider failures and process restarts without leaving a usable half-deleted account or reporting false success. Already-deleted identities are safe to retry. Do not leave student/public resume access to purged sessions. Account deletion is tested with disposable fixtures/mocks, not the owner's account.
- SQL owner locks/tombstones must serialize app mutations against deletion; frontend checks alone are insufficient. The normal API verifier already calls remote getUser rather than trusting browser claims.

## Contact us
- Category: Question, Problem, Feature request. Subject and message with clear length limits; reply-to is the verified professor email. Show the configured contact address. Ask users to omit student records and secrets.
- Save each request durably before attempting notification. Return a receipt/reference, with truthful queued/sent status. Preserve the message after delivery errors and support safe retry without duplicate submissions.
- Deliver notifications to gordon.maccoy@gmail.com through server-configured email transport, with the recipient configurable independently of authorization. Transport credentials and verified sender configuration are user-required setup; do not send real test emails without authorization. Use mocked transport in automated tests.
- The owner needs a private Support inbox to read queued requests even before email setup. Authorize it separately using a server-configured verified owner identity; changing the contact recipient must not grant administrative access. No professor may read another professor's requests through normal endpoints.
- Rate-limit submissions and notifications. No attachments in this version. The app is not an email relay: recipient/from are server controlled, and header injection must be rejected.

## Help
- A short help landing area with Take tour, common topics, and Ask OnScreen.
- Chatbot answers concise how-to and troubleshooting questions using a server-owned guide reflecting the actual app: professor/private/public/student screens; launch and QR; visibility FAIL/unlock/finalize; submission, timers and extensions; scoring/points/shuffle; library folders/import/AI review; results/Excel; profile/contact/account controls.
- No tools or actions: cannot alter settings, tests, enrollments, grades, billing or accounts. No access to student records, answer keys, library content, raw logs or credentials. Only the user's typed conversation plus the curated guide goes to OpenAI, with store:false.
- Clear AI disclosure and caution against sharing student data or secrets before the first message. Keep the bounded conversation transient; clear on sign-out/account switch. Render answers as plain text, not executable HTML/Markdown links. Guide content outranks user instructions; unsupported issues should direct users to Contact us rather than invent fixes.
- Reuse Development OPENAI_API_KEY/OPENAI_MODEL through a separate help adapter. Bound input/history/output and per-professor request/concurrency limits separately from test-authoring quota. Handle unavailable configuration/provider/rate failures with useful guide/contact alternatives and preserve the typed question.

## Future subscriptions
Add roadmap items for plans, subscription management, usage entitlements and billing provider integration. No paid/free promises, pricing, payment collection, checkout or fake working subscription controls now.

## Validation and configuration
Meaningful repository/API tests: profile ownership/limits, contact isolation/persistence/deduplication/email failure, privileged inbox authorization, help grounding/privacy/quotas/provider failure, deletion target protection/active sessions/concurrent writes/partial failures/retry/restart/terminal access. Browser checks: account menu, mobile/keyboard, profile save/reload, contact receipt/error, grounded chat response/fallback, deletion confirmation/cancellation, sign-out/account switch and preservation of current authoring/session flows.

Run build/check/full tests/browser checks and independent review, then commit/push to the existing Development branch and verify live assets/health. Report required Development admin-auth and email configuration. Never enter or request secrets in chat; the owner configures secrets directly in the hosting service. Real account deletion and real notification sends require their own explicit authorization and are not verification shortcuts.

## Approved
The user approved this design on November 6, 2026. Exact profile field styling, module boundaries, rate values and transport implementation are builder choices, constrained by the behavior above.
