# First-login walkthrough and starter test

## Goal
Help new professors understand OnScreen and try a small test immediately. Development environment only.

## Approach
The user chose a short skippable walkthrough with a replay button over an interactive spotlight tour. Use the existing responsive dialog styling rather than adding a tour dependency.

## Walkthrough
Show five brief steps after the first successful professor login: (1) Welcome and your own Practice Test; (2) Library: edit, organize, upload, or create questions with AI and review answers; (3) Launch: choose settings, let students join by QR with number and name, then Start test; (4) Classroom display versus private dashboard: public names/status only, private student numbers/progress, hidden-page failure after more than five seconds and professor unlock/finalize controls; (5) Results: rename, review, and download Excel after a test.

Provide Back, Next, Skip tour, and a final Get started button. A Take tour button remains available in the signed-in workspace. Replaying explains controls without creating sessions, launching popups, starting timers, modifying answers, or spending AI credits. Restore focus when the dialog closes; support Escape and small screens.

## Account persistence
Store onboarding version and dismissal/completion per verified professor in PostgreSQL, so refresh, another device, or token refresh does not restart the tour. Initial setup and starter-test creation must be transactional and idempotent across concurrent logins. Deleted starter copies must not reappear. Each new professor owns an independent editable copy, with fresh question and test IDs; never copy results, sessions, student information, or the original professor's folder.

Existing professors keep their tests unchanged and get the replay button; the automatic tour and starter copy apply to accounts with no existing tests or sessions when initialized. Record existing-account initialization so deleting their library later does not reseed it. Builder call: create the starter in Uncategorized Test, avoiding an extra class folder.

## Starter content — approved
The first question is "What is the capital of South Korea?" with Seoul (correct), Beijing, and Tokyo, worth one point. The user approved replacing the second question with "What is 2 + 2?", choices 3, 4 (correct), and 5, worth one point. Do not change the user's existing saved test. The user approved this design on November 6, 2026.

## Validation
Verify first login versus repeat login and existing accounts, account isolation, durable dismissal across reconnect/repository restart, concurrent initialization without duplicate copies, deletion without reseeding, replay without side effects, and keyboard/mobile dialog behavior. Deploy only to Railway Development after tests pass.
