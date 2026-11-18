# Admin accounts and registration — approved scope

- Move owner-only Admin Dashboard and beta-plan Beta Feedback to the main workspace navigation; keep responsive tabs compact.
- Require a country/region selection for new email and Google registrations, validate server-side, store in profile and display/search in admin accounts. Legacy users remain usable.
- Add reversible email bans with audit records, checked for every authenticated API request and professor socket access. Ban persists across account deletion/recreation and blocks both email and original account ID.
- Add owner-only permanent deletion using existing identity deletion and retry worker; typed email plus DELETE confirmation. Protect owner/self from ban/deletion. No real account is deleted during verification.
- Test non-admin denial, owner protection, stale-token/changed-email ban enforcement, unban, deletion retry/audit/data removal, country requirements and mobile navigation.

Update: user deferred permanent account deletion. Ship reversible bans only; retain existing self-service deletion unchanged. Add a loading state while Google sign-in resolves.
