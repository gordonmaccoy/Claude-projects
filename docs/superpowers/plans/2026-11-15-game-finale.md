# Game Finale Implementation Plan

> **For agentic workers:** Use subagent-driven development and red/green regressions for each independent part.

**Goal:** Give the professor a session-only large-class selector, livelier characters and illustrated question intros, and a podium that keeps final results secret until the reveal.

**Architecture:** Keep the game state server-authoritative; preserve the final answer poll without final cumulative scores, then move directly to the timed podium on teacher advance. Extend the existing UI and classroom sound controller with local assets. No change to graded tests, game score math, or Production.

**Spec:** The requested professor control, motion, question intro, response gong, and podium changes of Nov 15, 2026.

- [x] Test and move the 30/50-character option from editing into the professor session setup; keep the unchecked default.
- [x] Test the final round skips the leaderboard, freezes scoring, preserves the poll and withholds scores and ranks until their reveal.
- [x] Render podium medals and visible totals, then scroll only places 4 onward, with a reduced-motion alternative.
- [x] Show the deck artwork matched to questions 1–25, and a styled fallback number beyond the deck.
- [x] Schedule supplied gong on round close, crowd at each placement, and a trumpet before gold; preserve mute, timing and same-origin playback.
- [x] Add varied avatar side-to-side motion with a reduced-motion override and no additional avatar downloads.
- [x] Run syntax, build, and test suites, then distinguish local verification from real-device testing or deployment.

**Release QA:** The 272 non-browser tests, syntax checks and build pass. Run the updated browser game flow in Development (phone, projector, sound and a game with at least four distinct scores) before Production. The intro images came from the supplied 25-number deck; #15 carries its original stock watermark. Clear rights or replace third-party artwork and audio before a public launch.
