# True/False and AI-graded Short Answer questions

Add two question types alongside Multiple Choice and Fill in the Blank. Preserve existing quizzes and grading behavior.

## Approach
True/False uses a fixed pair of choices and deterministic marking. Short Answer uses a professor-provided model answer, optional marking guidance, and AI semantic evaluation. The user selected partial credit with professor override rather than binary grading. Existing exact-match Fill in the Blank remains available.

## Authoring and student experience
- True/False: fixed True and False choices; professor selects the correct one.
- Short Answer: model answer, optional marking guidance, and question points; students receive a multiline response field.
- Keep all delivery types, question/answer ordering rules, language selection, monitoring, and feedback timing working.
- Short answers have a bounded response length, proposed 2,000 characters.

## Grading
- AI evaluates meaning and required concepts against the model answer and guidance. Return a bounded earned-points value and a brief explanation. Treat student text as answer data, never as model instructions.
- Keep original AI assessment, professor override, and final earned points separately with an audit record.
- Run grading on the server. Use an exact normalized model-answer match without an API call when appropriate.
- Persist pending grading and retry failures. Never turn a provider failure into a zero. Show a grading-in-progress state until results are ready.
- Grade manual submissions, per-question submissions where feedback is enabled, timer expiration, and professor-ended sessions consistently. Prevent duplicate charges on retries.
- Existing inactivity FAIL remains zero unless professor overrides it; keep the underlying earned score.

## Results and exports
Show points and explanation privately to professors, with an edit-score action. Respect configured student feedback timing. Include fractional points in totals, averages, detailed results, Excel, PDF, and Google Sheets exports. Preserve the original AI score after an override.

## Validation
Test validation and persistence of both new types, AI score bounds and malicious answer text, retries, timer and professor-ended submissions, all delivery modes, overrides, answer-key privacy, and export consistency. Use mocked AI for automated tests; a small live provider check only if configured and authorized.

## Independent editor cleanup
Source excerpts collapse by default. Option image upload is inline beside Remove option. These visual changes are implemented separately and browser-verified.

## Review decisions
Pending scores show “Grading…” and are excluded from class averages; exports explicitly mark them pending. Round earned points to two decimals and clamp them within zero and question points. Immediate-feedback screens wait for grading and recover after reload without accepting a second submission. Deduplicate grading jobs and reuse persisted assessments; provider timeout charges cannot be guaranteed exactly once.

## Shipped behavior
True/False and Short answer are available in the question-type menu. Short answer requires a model answer, supports optional marking guidance, and allows 2,000-character student responses. AI grades meaning with partial credit using the existing configured OpenAI model. Exact model matches and unanswered responses do not need an API request.

Detailed Results provides Review score for submitted short answers. Professors can change points with a required reason; the original AI score and audit history remain stored. Grading delays show Grading… and retry automatically, including after session expiry or restart. Existing FAIL rules continue to show zero while preserving the underlying earned score.

Quiz Results also has independent grid/list controls with the choice remembered per account on this browser.
