# Beta welcome guide and feedback

User approved a small teacher beta guide and feedback form. Use the existing authenticated contact API so feedback reaches the admin support inbox and existing Zoho notifications. No invitations or unsolicited email are sent.

1. Add a concise shareable `/beta.html` guide: create a short quiz, join from a student device, run/submit, inspect/download results. Use simple numbered cards and links to existing feature guides.
2. Add Settings > Beta feedback with category, test stage, ease rating, what worked, and what to improve. Compose a bounded message and `[Beta feedback]` subject for `/api/contact`. Preserve retry IDs, prevent double send, clear after save and on sign-out; discard stale responses. A direct `/professor.html?feedback=beta` entry opens the form after sign-in.
3. Browser verification with real local API/store proves feedback appears in admin, errors preserve text, retry idempotency, and account reset. Check mobile guide/form. Run relevant regression checks and deploy Public.

No new backend endpoint, billing, identity system or database migration. Existing limits and email routing apply. Form is English initially and does not collect student names, answers or grades.
