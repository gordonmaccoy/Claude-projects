# OnScreen V2 configuration and verification

## Deployment boundary

Repository: `gordonmaccoy/Claude-projects`, root `/exam-monitor`, branch `onscreen/test-mode-hardening`, PR #6.

Only Railway **Development** is authorized. Startup refuses a Railway environment whose name is not `Development` (case-insensitive). Never merge PR #6 or change production source/settings as part of this work.

Initial inspection on 2026-11-06 (Asia/Seoul): project `carefree-cat`, app service `Claude-projects`, environment `Development`, branch `onscreen/test-mode-hardening`, PostgreSQL `Postgres-KnuT`, one replica. Only `DATABASE_URL` was configured. Public networking had no domain; the existing custom build command was `npm install`. No production settings were changed.

## Current Development configuration (2026-11-06)

- App: https://claude-projects-development.up.railway.app/professor.html
- Railway Development has APP_ORIGIN, SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY configured; DATABASE_URL remains the separate Railway Development database.
- Supabase Auth: onscreen-development, project manrnfqgtarscisbkyna, Seoul region.
- Site URL and exact professor.html redirect are configured. Email with confirmation and Google are enabled.
- Google Cloud project: onscreen-development; web OAuth client: OnScreen Development Web. Google remains in Testing mode; gordon.maccoy@gmail.com is an approved test user. The client secret is stored only in Supabase provider configuration, never in source.
- Live Google callback verified: the Development professor workspace displayed the signed-in account.
- Classroom launch and reopen use the same named window; reopening focuses/reuses it instead of creating another display.

## Configuration reference

1. Keep `DATABASE_URL` referencing the **Development** PostgreSQL instance. Do not paste it into browser code or source control. Startup initializes additive V2 tables and refuses to run without storage.
2. Generate/use a public HTTPS domain for the **Development app service** so student QR joins are reachable. Set `APP_ORIGIN=https://<development-domain>` with no trailing slash. If omitted, the app uses Railway's automatic `RAILWAY_PUBLIC_DOMAIN`. A service without a public domain can start, but phones cannot reach its QR links.
3. Use a dedicated Development Supabase Auth project. Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` on the Development app. The publishable key is intentionally public; never use a secret or service-role key. No Supabase database is used for exams. Missing auth configuration disables sign-in and all professor APIs reject access.
4. In Supabase Auth, enable email/password with email confirmation. Set Site URL to the Development app and allow `https://<development-domain>/professor.html` as a redirect. Configure SMTP for reliable confirmation/password-reset delivery.
5. Enable Google in Supabase Auth. Create/select a Google OAuth web client, configure the Supabase callback URI shown in that provider's settings, and enter its client ID/secret in Supabase. Keep the secret there, not in OnScreen browser code.
6. Use Node **22+**. Recommended Railway build: `npm ci && npm run build`; start: `npm start`; healthcheck: `/health`. The committed browser bundle also supports a production-dependencies-only install when a build is not run. Do not add a production environment deployment.

Official references: [Supabase server-side identity verification](https://supabase.com/docs/reference/javascript/auth-getuser), [Google sign-in setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

## Persistence and migration

The lockfile now includes `pg` and the complete dependency graph, fixing the original clean-install mismatch. `store.js` replaces the old write-only persistence path. Session state is read from PostgreSQL on every operation, so startup has no volatile session cache to rebuild. `SELECT ... FOR UPDATE` serializes writes; acknowledgements follow COMMIT. Test launches contain immutable copies of library questions. Library edits/deletes do not change launched sessions.

V2 tables are additive:
- `onscreen_v2_tests`: owner ID and editable test document.
- `onscreen_v2_sessions`: owner ID and session document containing snapshot, enrollment capability hashes, drafts, submissions, hidden intervals and override audit history.

Legacy `onscreen_tests`, `onscreen_sessions`, `onscreen_students`, `onscreen_submissions` are not deleted or modified. They lack authenticated ownership and resume capabilities. An administrator must identify the intended professor and explicitly map/import legacy records before they can appear in an account's V2 history. Do not claim ownership by first sign-in. Historical migrations are not automatically performed by this release.

The old `persistence.js` module is retained solely as a reference to the legacy schema; the V2 server does not import it.

## Acceptance checks

Automated:
- `npm ci` (clean install), `npm run build`, `npm run check`, `npm test`.
- `npm run test:ui`: desktop professor, mobile-sized student, separate popup, QR expansion, Library save, waiting/start, submission, reload, live grades, Results download and account-switch privacy.
- Repository/integration tests use actual PostgreSQL SQL execution through PGlite. They cover rollback, fresh repository recovery, restarted HTTP/socket server, drafts, ownership, privacy, concurrent submission, durable FAIL/override and Excel text safety. External auth responses are simulated in browser testing; real Google/email services are not verified by those tests.

After configuration, manual Development-only acceptance:
- Register/confirm email, sign in/out, reset password, and sign in with Google.
- Run two professor accounts; verify isolated tests/results and no retained details after account switching.
- Join real student phones; check projector shows names only and the private dashboard has numbers/results.
- Hide for exactly/less than 5 seconds (no FAIL), then >5 seconds (FAIL). Return, submit, verify effective zero and raw score. Override with a reason; verify restored score and export.
- Disconnect Wi-Fi without hiding; verify red but no automatic FAIL.
- Restart app and Development database; resume professor session/student draft and final submission; verify historical results remain.
- Open exported workbook in Excel and verify leading-zero identifiers, natural student-number order and effective grades.

Live Google sign-in has been verified through the professor workspace. Real email confirmation/password-reset delivery, Railway database-restart acceptance and real-phone visibility checks remain pending. Automated checks alone do not certify real-phone visibility behavior.
