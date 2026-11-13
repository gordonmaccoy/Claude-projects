# Examio Live Game
Integrated separate Game library and live game engine; academic tests unchanged. Games are MCQ with 2–5 choices, per-question timer 5–240 seconds, default 20. Explicit copy both directions, reject incompatible tests unless compatible-only selected. Classic published Kahoot single-select scoring; server receipts authoritative, no millisecond fairness promise. Nickname QR/PIN join, current question only, host controls reveal/leaderboard/next, podium. Resume tokens restore score; teacher-approved device recovery rotates token. No grades/reports; active game state durable for reconnect/restart, expires after 24h inactivity and is removed on close. Test inactivity rules never apply.

## Later user additions
- Optional teacher-controlled media stage before each question; image/audio/video and YouTube. Teacher plays source before countdown, students wait without automatically streaming third-party media.
- Player avatar chosen on join, 36 original consistently styled characters, retained with player on reconnect, visible on roster/leaderboard/podium. Final locally served WebP artwork follows the owner-approved full-body cartoon creature style.

## Implementation defaults
- HTTP polling once per second uses existing authenticated server and shared database, separate from academic sockets. Countdown includes question data without keys to allow local timed presentation; server receipt time controls scoring. Network latency still affects fairness; do not promise millisecond cross-device fairness.
- Game sessions expire after 24 hours without meaningful game activity; polling does not extend expiry. Host Close deletes temporary state, no result reports.
- Up to 200 players/session; 3 active games/owner. New joins stop at game start, but existing players resume throughout.
