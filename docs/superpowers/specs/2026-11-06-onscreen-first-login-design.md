# First-login walkthrough and starter test

## Goal
Help new professors understand OnScreen and try a small test immediately. Development environment only.

## Approach — revised after user feedback
The initial prose walkthrough was too long. The user now requests short instructions, screenshots or video, click-on-X interaction, and a clear distinction between the professor laptop, public classroom display, and student phone/tablet. Use real app screenshots and interactive demo targets with large touch/keyboard alternatives; no tour dependency or real exam side effects.

## Walkthrough
Eight visual scenes: select Practice Test; launch settings and a separate class-display window; move that window to the projector and expand its QR; student name/number join; private professor Start test; student answer, submit and confirmation; student receipt with optional score; private professor progress/scores, ending the session and Results/Excel. Each frame has one short instruction. Screenshots use a disposable local fixture (fictional Alex, example number 1001), never real student data. The classroom QR is an example, not a joinable class.

Always label the screen role and that this is an interactive demo with no real session. Screenshot highlights and large action buttons advance local scenes only. Retain Back, Skip, Escape, replay, persistent dismissal and focus restoration. Show a fallback action if an image fails to load. No real popup, download, AI call, enrollment, timer or score change occurs during the tour.

## Account persistence
Store onboarding version and dismissal/completion per verified professor in PostgreSQL, so refresh, another device, or token refresh does not restart the tour. Initial setup and starter-test creation must be transactional and idempotent across concurrent logins. Deleted starter copies must not reappear. Each new professor owns an independent editable copy, with fresh question and test IDs; never copy results, sessions, student information, or the original professor's folder.

Existing professors keep their tests unchanged and get the replay button; the automatic tour and starter copy apply to accounts with no existing tests or sessions when initialized. Record existing-account initialization so deleting their library later does not reseed it. Builder call: create the starter in Uncategorized Test, avoiding an extra class folder.

## Starter content — approved
The first question is "What is the capital of South Korea?" with Seoul (correct), Beijing, and Tokyo, worth one point. The user approved replacing the second question with "What is 2 + 2?", choices 3, 4 (correct), and 5, worth one point. Do not change the user's existing saved test. The user approved this design on November 6, 2026.

## Validation
Verify first login versus repeat login and existing accounts, account isolation, durable dismissal across reconnect/repository restart, concurrent initialization without duplicate copies, deletion without reseeding, replay without side effects, and keyboard/mobile dialog behavior. Deploy only to Railway Development after tests pass.
