# Professor interface preferences

Implement the user's six requested adjustments on the Public release branch.

- Keep-login checkbox is unchecked by default (implementation choice). Supabase tokens use session storage unless opted into local persistence. Existing persistent sessions migrate without dropping the current login. PKCE verifier storage remains independent so emailed confirmation/recovery links can open in another tab. Denied browser storage falls back to memory.
- Sign out opens a branded native dialog. No, X and Escape cancel; Yes signs out and reports errors without hiding them.
- Top-bar white/blue theme switch shares the student's theme preference key. The professor stylesheet supplies blue surfaces, readable controls and branding.
- Both calculator and test launches send the professor interface's current language; remove separate selectors. Language remains fixed for each launched session and professor-authored content remains unchanged.
- Remove the manual Add a practice test action; retain existing tests and first-login starter behavior.
- Remove bottom monitoring explanatory text from professor and student screens; retain policy links.

Use the existing auth client, dialog pattern, translation dictionary and CSS variables instead of introducing a UI framework. Test storage behavior, existing signup, logout cancellation/confirmation, theme persistence and launch payload languages. Public only; no legacy production configuration changes.
