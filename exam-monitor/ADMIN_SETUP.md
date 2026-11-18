# Examio owner dashboard

Open `/admin.html`. Sign in using an existing, verified Examio account. A Zoho mailbox is separate from the Examio login: create the Examio account through `/professor.html?signup=1` and verify the code sent to that mailbox first.

## Public environment configuration

- `ADMIN_OWNER_EMAIL=admin@examio.io`: allows initial binding to the remotely verified Supabase user ID. The first matching verified account is recorded in `onscreen_v2_admin_owner`. Reusing the email later does not grant access to a different user.
- `ADMIN_OWNER_ID`: optional explicit server-managed Supabase UUID override for deliberate owner recovery. It takes precedence over email bootstrap. Never copy a profile role or client-supplied ID here.
- With neither variable set, administration is disabled. Profile role “Admin” has no platform privileges.
- `CONTACT_TO=support@examio.io`: website request notifications go to the Zoho alias. The default is also this address. Existing `RESEND_API_KEY` and `EXPORT_FROM` are reused. No new credentials are exposed to the browser.

Use Railway's **Public** environment only; legacy Production is unrelated. Changing owner identity requires an intentional server configuration update. Deleting the owner's Examio account does not reset the owner binding.

## What is available

- Overview: workspace accounts, recent activity, quizzes, games, live sessions, open requests.
- Accounts: searchable/paginated workspace accounts, usage counts, private notes and plan labels.
- Support: searchable/paginated website requests, open/in-progress/resolved workflow, private notes, independent email-delivery status.
- Plans: Beta, Free, Pro and Institution labels. Everyone retains existing free functionality. No billing, paid subscription, renewal, access limit or pricing is enabled.
- Activity: searchable/paginated audit history of admin account/ticket updates. Notes and request bodies are not copied into the audit trail.

Account activity begins when this release is deployed. Missing activity dates mean “not recorded,” not that the account never signed in. The account directory covers app workspace accounts, not every unverified Supabase signup. Account suspension, impersonation, bulk mail, payment processing, and reading student answers are deliberately absent.

Zoho remains the mailbox for email sent directly to admin/support. The admin Support inbox displays requests submitted through Examio's Contact us form; it does not import arbitrary mailbox email. Saving a support note or changing status never sends a reply.

## Security and verification

Existing verified token middleware protects every `/api/admin/*` request; each request also checks server-side owner authorization. Data uses no-store responses. New administration tables enable RLS with no browser roles granted access; the trusted PostgreSQL service connection owns them. Client UI uses text nodes, clears private data on sign-out/account change and discards stale responses. Admin updates and audit records commit together with optimistic versions to prevent stale overwrites. Account deletion removes administration notes and support workflow records while retaining minimal audit IDs.

Run `node --test test/admin.test.js`, `node test/admin-browser.js`, `npm run check`, and the full test suite. Browser tests use synthetic local accounts and replace only external Auth; the API and database are real local test instances.
