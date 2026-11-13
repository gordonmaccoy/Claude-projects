# Examio Registration Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans task by task.

**Goal:** Separate sign-in and registration, with profiles and email-code verification.
**Architecture:** Existing professor page hosts a separate registration controller selected by query string. Supabase owns identities and verification; an authenticated endpoint validates and persists registration profiles. Existing account JSON avoids a schema migration.
**Tech Stack:** Express, vanilla JS, Supabase JS, PGlite, Playwright.
**Spec:** docs/superpowers/specs/2026-11-12-examio-registration.md

## Global constraints
- Required role: teacher, professor, admin, it. Optional phone. Typed institution.
- Role grants no permissions. Never store passwords or OTPs locally.
- Keep existing sign-in, recovery, account data and branding.
- Public release only; legacy production unchanged.

## Review focus
- Invalid/missing role or terms cannot finish registration.
- Email mismatch and duplicate submits do not create extra requests.
- Wrong/expired verification codes remain retryable; resend is throttled.
- Google redirects resume profile completion; existing accounts bypass registration.
- Settings saves preserve consent and registration fields.

### Task 1: Validated registration persistence
- [ ] Add failing validation/persistence tests for required role, consent, phone, owner isolation and settings preservation.
- [ ] Extend settings-service validation and add authenticated `/registration` route. Store server consent time and merge settings updates.
- [ ] Run settings and registration tests.

### Task 2: Registration and login UI
- [ ] Add failing browser checks for step validation, Google redirect, signup, wrong OTP/resend, successful completion and distinct landing links.
- [ ] Add registration.js, branded wizard markup/styles, Google icon and New to Examio section; integrate existing auth lifecycle and Korean strings.
- [ ] Run browser checks, existing landing/settings/auth checks and syntax checks. Inspect mobile/desktop screenshots.

### Task 3: Delivery and release
- [ ] Configure Supabase Public signup email OTP and 15-minute expiry, preserving other auth settings. Verify config read-only after save.
- [ ] Review diff, run applicable tests, commit and push Public release. Verify live routes/assets. Report any remaining email delivery configuration.

## Execution ledger
- User approved required role choices, optional phone, typed institution, and verification-code page. Continue in the existing release checkout as in preceding authorized edits.
- Tasks 1 and 2 implemented and checked with registration unit/API tests, controller browser checks and full professor-page/API/PGlite integration; mobile and desktop captures inspected. Full 55 tests passed with `--test-isolation=none`; PDF parser worker exits under normal isolated runner but all seven import tests pass directly. No PDF implementation changes made.
- Review found first-time Google identities created through normal Sign in could bypass profile completion. Added an owner-scoped history check so new users complete registration and legacy users retain access.
- 2026-11-13: Resend domain added in Tokyo. DKIM TXT and two sending CNAME records saved in Porkbun and confirmed through public DNS. Existing website, MX forwarding, Google ownership and Railway records preserved. Resend verification in progress. SMTP credential not yet created; release remains unpublished.
- 2026-11-13 update: Resend verified examio.io. User approved creation of a domain-scoped sending-only key and its storage in Supabase Public SMTP. SMTP sender Examio <support@examio.io>, smtp.resend.com:465, saved and verified after reload; key kept out of source and logs. Branded confirmation-code email published with explicit approval. User set OTP expiry to 900 seconds; read-only provider inspection confirmed 900 seconds and 8 digits. Fresh focused regression suite passed 14/14 with localhost access, browser and real-app integration passed, syntax and diff checks passed. Actual inbox delivery still needs a new-user signup check after release.
