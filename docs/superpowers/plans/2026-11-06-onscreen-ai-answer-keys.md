# AI-assisted existing-test import

User wants AI to determine correct answers and do as much as possible seamlessly. Implement on existing Development branch only.

- Primary Upload a test flow uses AI after explicit source/cost consent, preserving recognized questions/options/points/provided keys; local import remains a secondary option. Local parse plus AI fills missing keys; unrecognized layouts use structured AI organization constrained to original source wording.
- Editor also offers Determine answers with AI for current drafts without reupload. Preview only, never auto-save/launch or change live snapshots. Existing supplied keys are retained; uncertain proposed keys remain unresolved with an explanation for professor review.
- New answer-key module validates partial drafts, bounded questions/options/points, structured provider output IDs/counts, and source wording on fallback. Explanations private to library/professor, never student/public.
- API import-ai and answer-key require professor auth/config; share existing AI request budget with generate. Fix provider-error mapping to distinguish API credits/spend limits from request throttling without exposing raw provider errors/secrets.
- UI consent applies to upload AI path; counts/types/difficulty only for generating new questions. Existing-test AI needs no question count. Editing is protected against stale async results.
- TDD: exact ten-question sample only6missingMC keys go to solver; provided4blank keys retained. AI uncertainty/invalid IDs/output and quota/rate errors. Fallback unnumbered source respects wording. HTTP auth/no persistence, browser automatic AI import and editor action with simulated provider, grades/privacy regression. No paid test call without separate authorization.
- Final independent review, tests/build, commit/push and verify Railway Development.

## Ledger
- User clarified AI should be seamless; primary upload flow is AI-assisted with explicit consent, local extraction remains secondary. Added AI organization fallback and editor completion.
- User reported Extend1minute looks like1second on professor end-time display. Independent read-only diagnosis confirmed +60000ms and correct formatted endtime in3locales; no arithmetic defect reproduced. Add explicit remaining duration/+60second confirmation and professor display regression, preserving timer arithmetic.
- User confirmed API credits reloaded. A single small grammar-key request will be used for live Development verification after deployment; no saved test or exam launch required.
- Final review fixes: reject omitted identifiable source questions, restore supplied answer keys and point values after AI organization, retain conflicting supplied keys as unresolved, and preserve private MC explanations on save. Regression tests passed; build/check and all 32 unit/API tests passed.
