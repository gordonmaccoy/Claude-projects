# Examio Game Encore Implementation Plan

> **For agentic workers:** Use subagent-driven development and verify each unit before integration.

Goal: polish the Development game using the November 15 screenshots and November 14 clip. Keep quiz production, game scoring, polls, artwork and lobby/score music intact. The clip uses a dark stage and sequential podium risers, ending with a winner spotlight; keep Examio branding and original sound synthesis.

1. Lobby: parity with quiz display header; no PIN instruction; click-to-enlarge QR; centered bottom Start; compact tiles; speaker popover far right, vertical volume and mute. Cover semantics and controls with targeted tests.
2. Identity: optional Require names launch setting, initially on (preserve previous behavior). When off, use the server’s exact avatar manifest names, no nickname input, retain score and recovery. Test both choices and invalid values.
3. Timing: separate short synced intro and response-closed phases with server-owned boundaries; preserve teacher control between questions, 5-second preview, answer eligibility, and existing score animation. Test both ways a round ends, transport views, media, and private state.
4. Finale and sound: reveal third, second, first with a staged raised podium, cheers and a distinct winner fanfare; use the existing score page and extend the original gong rather than importing audio from the reference. Respect reduced motion and mute. Test cues, timeline and missing places.
5. Integrate on local copy based on exact Development tree. Run full suites and build. Check before changing deployments; never touch Public.
