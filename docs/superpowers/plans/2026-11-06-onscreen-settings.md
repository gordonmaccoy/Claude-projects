# Settings implementation plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and dispatching-parallel-agents for the independent help/UI modules. TDD per task; independent final review.

**Goal:** Professor settings/profile/account deletion/contact and grounded AI help.
**Architecture:** Existing authenticated workspace, separate UI/help/account-support modules, durable owner-scoped PostgreSQL state and deletion/email jobs. No subscriptions yet.
**Tech Stack:** Existing Express, pg, Supabase auth, Responses API, plain JS, PGlite/Playwright. No client secrets.
**Spec:** ../specs/2026-11-06-onscreen-settings-design.md (user approved Nov 6).

## Constraints and review focus
- Existing Development branch/PR only; never production, real-owner deletion or real test email sends.
- Profile/contact/help isolation and account switch must not leak previous users' data.
- Owner-row transaction locks must cover writes and deletion, including launch races and restart recovery.
- Contact idempotency, transport errors and persisted receipts; recipient and support-admin identity are separate server settings.
- Help is guide-only/no tools/student data; bound history/output/quota and render plain text.
- Preserve unsaved authoring, active sessions, interactive tour and mobile keyboard access.

## Tasks
- [x] Core persistence: account-store.js, store.js transaction-aware owner locks/wrappers; settings-service.js and account deletion intent/retry/purge. RED→GREEN repository/API tests including failure/restart and denied writes.
- [x] Help module: help.js, help-guide.js and test/help.test.js. `createHelpAssistant({key,model,fetch})` returns async `({question,history}) => {answer,topics}`; export `helpGuide` array `{id,title,text}`. No routes or UI ownership in this task. Structured provider fake tests first.
- [x] Settings UI: public/settings.js + professor.html/css; factory `createOnScreenSettings({api,onSignOut,onDeleted,onTakeTour,onClose,notify})` returns `{setAccount(account),reset(),open(section)}`. Separate browser test. Main agent integrates professor.js.
- [x] Server routes and services: GET /settings; PUT /profile; POST /contact {requestId,category,subject,message}; GET /contact own receipts; GET /support/requests admin only; GET /help/guide; POST /help {question,history}; DELETE /account {confirmation,email}. GET settings returns {profile:{firstName,lastName,institution,email},contactEmail,helpConfigured,deletionConfigured,supportInboxAllowed,accountState}. Contact returns {id,status}. Help returns {answer,topics}. Deletion returns {state:'deleted'|'deleting'}; frontend signs out and reports honest state.
- [ ] Integrate UI/auth state/menu sign out, targeted/full browser and automated tests; fresh final review; docs/config, commit/push and verify Development.

## Configuration choices
Use server-only SUPABASE_ADMIN_KEY for self-account deletion. Use Resend HTTP transport with RESEND_API_KEY, CONTACT_FROM, CONTACT_TO (default gordon.maccoy@gmail.com); SUPPORT_ADMIN_EMAIL independently defaults to the verified owner's email. Missing mail transport queues requests in a private Support inbox; no false sent claim. Help uses existing OPENAI_API_KEY/OPENAI_MODEL with separate 20/hour quota. Contact 5/hour; server controlled routing, validated fields.

## Ledger
- Continue in the explicitly requested existing Development branch. User approved design; preserve established inline execution and delegate only bounded independent modules as allowed by dispatching-parallel-agents skill.

- Persistence RED: missing profile/contact methods; GREEN: ownership, dedupe/queued delivery, durable frozen deletion, restart cleanup, terminal access, neighboring owner retained. Existing store/onboarding/API tests passed under owner transactions and nested savepoints.
- Help: six provider-fake tests passed, no real records sent. UI: separate mocked browser suite passed, including account-switch stale responses, safe plaintext output, retry UUID, typed deletion confirmation and mobile/Escape. Integrated browser smoke exercises real local profile/contact/help APIs plus prior exam flows.
- Independent review Important finding: settings retries had been awaited in the live monitoring sweep. Fixed with a separate guarded timer. RED regression reproduced the stalled tick; GREEN confirms monitoring ticks finish while a retry remains stalled. No other actionable findings.
- Additional RED/GREEN fix: profile inputs stay disabled until initial data arrives, preventing slow-load overwrite of new typing.
- Verification: build/check, 45 automated tests and the full browser suite passed; targeted help tests passed after adding guide troubleshooting detail. No real account deletion or email sent.
- Final verification: all 45 tests passed in the serial run and integrated/full browser suite passed. The pre-existing intermittent native Windows PDF-worker process exit occurred on one parallel rerun; isolated PDF tests and the complete serial suite passed without PDF code changes. This local flake remains outside the Settings change.
