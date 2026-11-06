# OnScreen: classroom locks and test authoring

Status: design for review, not yet implemented. Continues the working Development app on `onscreen/test-mode-hardening` (PR #6).

## Purpose and constraints

Improve student identification, make a five-second failure enforceable in both activities, and make authoring/organizing tests practical for multiple class sections. Keep Express, Socket.IO, Railway PostgreSQL, Supabase professor authentication and the existing Excel export format. Development only; never modify or deploy production. Preserve existing library questions, saved results, drafts, ownership and leading-zero student identifiers.

## Approach

Extend the existing app incrementally. A rewrite would unnecessarily risk the working QR, authentication and Excel flows. Deliver independently verified stages: monitoring/lock behavior; mixed question authoring and ordering; folders and result labels; document import. Existing tests without an explicit question type continue to be multiple choice.

The import mode is the one user decision still outstanding: importing questions already present in a document versus AI-generating questions from source material. The two modes are described below; only the selected mode is included in the final approved design. No AI provider, billing commitment or external document upload is assumed.

## Student identification

- Accept only ASCII digits 0–9 for student numbers, 1–64 characters, validated in the browser and server.
- Preserve the value as text, including leading zeroes. Use a numeric keyboard hint on phones; reject invalid pasted input with an explanation rather than silently converting a name into a number.
- Continue requiring a name. Never expose student numbers on the classroom display.

## Failure, locking and professor recovery

- Once the calculator session is running or the professor starts a test, confirmed continuous page-hidden time strictly greater than 5000 ms produces a durable failure.
- The classroom name tile becomes shaded red with `FAIL`. The private professor dashboard says `FAILED` and shows an `Unlock & continue` action.
- The student's calculator/questions become locked, with a blocking `Call professor` message. Escape, reload, reconnect and normal client events cannot remove the lock. The server rejects answer changes/submissions while locked.
- Preserve the calculator expression locally and save/preserve test drafts. Do not discard answers on failure or unlock.
- Professor unlock requires ownership verification and an audit reason. It clears the active failure/lock, forgives the current hidden interval and lets the student continue. A later new hidden interval can fail again. The incident and override history remain durable.
- Calculator failures do not create scores or saved test Results. Test failures retain the effective-zero rule; any original grade/draft and audit evidence stay private. A professor override restores normal grading.
- Network loss alone remains distinct from a confirmed hidden-page event: it shows inactive/red but does not itself trigger an academic failure. This continues the existing agreed rule and avoids treating a Wi-Fi outage as page switching.
- Waiting-room time does not trigger failure.

## Submission

- After a successful durable final submission, the classroom tile becomes light green and says `Test Submitted`.
- Stop client visibility/heartbeat monitoring for that submission. The server ignores later visibility/disconnect events for grading and does not add post-submission inactivity incidents.
- Submitted status survives closing/reopening the page and server restart. The final test remains locked against editing and displays the student's effective score immediately.
- Public display continues to exclude numbers, scores, answer keys and private incident details. `FAIL` and `Test Submitted` are the explicitly requested public status labels.

## Mixed question builder

- Each question has a type: Multiple choice or Fill in the blank. Mix both types in one test.
- Multiple choice retains the existing options/correct-choice workflow and one point per question.
- Fill in the blank starts with one text-answer field per question. The professor supplies one or more accepted answers and can choose case-sensitive matching. Default matching ignores case and trims/collapses extra whitespace; it does not invent synonyms or use fuzzy/AI grading.
- Grade both types on the server, with no answer key or accepted-answer list in student/public payloads. Keep the same absolute-score/percentage export columns and student-number sorting.
- Questions have drag handles to reorder them, plus Move up/Move down controls for keyboard/touch accessibility. Reordering retains IDs, text, choices, correct answers and type. Persist the exact order; launched sessions keep their immutable snapshot.
- Imported questions use the same editable builder and validation as manually authored ones.

## Class folders

- Professors can create named class folders in Library, select a folder when saving/editing a test, and move a test by changing that selection.
- Folder ownership is verified server-side. Folder names are limited and cannot be used to reference another professor's records.
- Library and Launch display expandable folder groups with test counts. Existing tests appear under `Unfiled`; there is no forced migration or loss of tests.
- Folder assignment does not change a test's launched snapshots or historical results. Folder deletion/nesting are outside this request.

## Result labels

- Completed test sessions have a Rename action in Results, limited to the owning professor.
- Save a separate result label, e.g. `Economics 101 — Section B — Quiz 2`; never rename the underlying library test or change its answer key.
- Retain date, original test association, grading/audit history and the existing Delete results action.
- No calculator results are introduced. The Excel sheet layout stays unchanged.

## Document import: selectable scope

### A. Import existing questions and answers (recommended when uploading a ready-made test)

- Upload a text-based PDF or Word `.docx` file in Library. Extract locally on the application server, using file-size, type and content limits. Do not send documents to an AI service.
- Recognize clearly structured numbered questions, multiple-choice options, answer markers/keys and fill-in answers. Do not infer a correct answer when the document does not provide one.
- Open an import preview in the normal builder. Show unrecognized/missing answers and require professor review/correction before saving to Library. Never launch or publish an import automatically.
- Provide a small downloadable/example formatting guide. Complex layouts, image-only/scanned PDFs and legacy `.doc` files receive a clear explanation; they are not silently claimed as successful imports. Original uploads are processed in memory and are not retained as stored library attachments.

### B. AI-assisted questions from source material

- Extract text from PDF/Word and generate new questions grounded in that source, with selectable number/types/difficulty and evidence for proposed answers.
- Require professor review before saving or launching. Keep generation separate from live exam monitoring and grading.
- This replaces the earlier roadmap-only status only if explicitly selected. It requires an agreed AI provider and configured credentials before live use; document transmission destination and any nonzero costs must be confirmed before generation.
- Unsupported scans need a separate OCR decision; no OCR service or data transfer is assumed.

## Verification

- Domain tests: reject nonnumeric identifiers and preserve zeroes; exact five-second boundary; calculator and test lock; unauthorized/authorized unlock; preserve drafts; prevent locked writes; never fail/monitor after submission; mixed grading and no leaked answer keys.
- PostgreSQL/HTTP/socket tests: ownership for folders/rename/import; recover locks, accepted answers, order, folder assignment and result labels after restart; export regression with mixed tests.
- Browser tests: invalid typing/paste, blocked student controls and Call professor overlay, professor unlock, public FAIL/submitted styling, drag plus keyboard ordering, blank-answer entry, expandable class folders and rename isolation.
- Import tests use real PDF/DOCX fixtures for the selected mode, malformed/oversized files and preview validation. Real AI calls remain configuration-dependent if mode B is selected.
- Run existing integration/browser suites and preserve the one-classroom-window regressions before a Development-only deployment.
