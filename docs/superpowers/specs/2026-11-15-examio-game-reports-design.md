# Examio Game Reports
Save newly completed games automatically, not abandoned games or historical public sessions. Use a private, owner-scoped durable snapshot, not temporary room history or Quiz Results. Preserve final names (or avatar names), ranks, scores and aggregate correctness, but no identities beyond display names or per-answer logs. Show Game Reports beneath Games in Progress, dated newest first, collapsed on load. Show Summary, Participants and Questions like the supplied reference, with selection and confirmed deletion. No production publish in this task.

## Operational notes
- The snapshot is saved at the transition to the podium; the workspace automatically looks for it after the ceremony. Old rooms are not eligible.
- Accuracy treats unanswered questions as not correct, and elapsed play time is measured from Start Game to final answer closure, not including the lobby or podium.
- Preview with synthetic names. Verify the workspace report flow and account cleanup before promotion. If reverting after reports exist, retain the account-deletion hook so users who delete their accounts during the rollback do not leave saved reports behind.
