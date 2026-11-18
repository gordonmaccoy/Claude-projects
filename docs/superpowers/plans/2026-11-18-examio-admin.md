# Examio admin dashboard implementation plan

> Execute inline using executing-plans and test-driven-development, followed by a fresh security/code review.

Goal: Give the owner a private control panel for free beta testing, workspace accounts, support requests, and future plan organization.

Architecture: Dedicated admin page, existing verified Supabase authentication, server-only owner binding, PostgreSQL administration records and transactional audit events. No billing integration or student-record browsing.

Tech stack: Existing Express, PostgreSQL, vanilla JS, Supabase Auth, PGlite and Playwright.

## Global constraints
- Initial owner is admin@examio.io, explicitly configured by server environment; first verified login binds a stable user ID. Later email reuse cannot inherit access. No user-editable role grants privileges.
- All test users retain current free access. Beta/Free/Pro/Institution labels prepare segmentation only; no charges, subscriptions or limits are activated.
- Support inbox contains website contact requests. Zoho remains the mailbox for emails sent to admin/support; no implicit mailbox sync or outbound replies.
- Do not alter live classroom behavior, existing account deletion states, or add partially enforced account suspension.
- Search and paginate account/support/audit data. Escape untrusted text through DOM APIs. Clear sensitive UI on logout and reject stale requests.
- Retain minimal immutable audit metadata; delete admin notes and support handling records when an account is deleted.

## Task 1: Backend administration
Write failing authorization, persistent ownership, validation, pagination, audit and deletion tests. Add admin store/controller, additive initialization, verified account activity tracking, and owner access discovery. Expected: targeted tests pass; ordinary accounts cannot read or mutate admin records.

## Task 2: Dashboard
Build responsive Overview, Accounts, Support, Plans and Activity views with existing sign-in/session lifecycle. Add owner-only workspace link. Edit plan labels and private notes, resolve/reopen requests, show email delivery independently. Expected: browser verifies real persisted changes, denial, mobile sizing and logout cleanup.

## Task 3: Release
Run complete suite and checks; fresh review, fix material findings. Configure Public-only owner email and support recipient; deploy through existing public branch and verify health/assets. Owner must create/verify the separate Examio login if absent; Zoho mailbox creation is not Examio signup.

## Review focus
Privilege escalation, email reuse, owner binding races, stale UI responses after logout, admin input validation, audit atomicity, PII deletion and regression to classroom routes.
