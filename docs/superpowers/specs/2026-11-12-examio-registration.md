# Examio registration

Keep Examio branding. Sign in stays at `/professor.html`; Get started and New to Examio link to `/professor.html?signup=1`.

Registration has Profile (first/last name, email and confirmation, password and confirmation, or Google), Institution (organization type and typed institution), About you (required Teacher/Professor/Admin/IT role, optional phone, required terms/privacy consent), then email verification. Email verification offers code entry, resend with cooldown and Back to login. Google verifies email through OAuth and collects the same profile without a second password or email code.

Store profile in the existing owner-scoped account JSON. Role is descriptive, never authorization. Existing accounts and sign-in/recovery must keep working. No passwords or codes in browser storage. Supabase confirmation email must include its OTP; configure 900-second expiry and keep a confirmation link fallback. Do not change legacy Railway production.
