# Examio Game Mode Public Release Candidate

**Goal:** Port the tested Development game onto current Public without changing grading, sharing or monitoring behavior.

**Base:** Live Public commit `174e9bb223349db00eae54501a7e4a9833737a71`. Game source: Development `ed0a249558ba17ad20d8fd631a9d3c026af94b9f`. No production deployment or real student data in integration testing.

- Port only game files, auth/navigation hooks, and additive database initialization. Preserve Public classroom visuals, privacy, security, quiz sharing/contact book and PDF answer-key recovery.
- Generate and validate original question-number artwork and sound clips; do not copy supplied third-party assets into the candidate.
- Verify API/DB migration on synthetic data created by the previous Public build. In the same application, run a graded quiz and a 32-participant game; confirm real separation of records, sharing and grading.
- Check rollback compatibility by restarting the previous app against the upgraded synthetic database.
- Run project checks and browser/real-device tests where available. Do not cut over until Public base is rechecked, real-device gameplay and rollout gates are satisfied, and Public publication is explicitly authorized.
