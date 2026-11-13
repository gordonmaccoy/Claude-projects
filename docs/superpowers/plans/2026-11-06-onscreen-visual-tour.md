# Visual interactive tour revision

User requests shorter copy, screenshots/video, click-on-X interaction, and explicit projector/professor/student views. This replaces the previous prose tour on the existing Development branch.

- Use real screenshots captured from the local app with fictional data and the two-question Practice Test. No live student records or credentials in assets. Prefer screenshots over video so users control pace and can interact by keyboard/touch.
- Eight quick scenes: select test, launch settings, separate projector window/expand QR, student join, private professor Start test, student answer/submit, student receipt, private results/export. Each scene has one short instruction and a highlighted clickable control. Show an always-visible demo label. Keep Back/Skip/replay and durable dismissal; no real sessions, AI calls, popups, downloads or grade changes from the tour itself.
- Capture deterministic screenshot assets plus relative hotspot bounds using a local-only fixture; interactive controller remains separate from production session controls. Responsive layout and large action-button alternative to small hotspots.
- RED/GREEN browser checks for required clicks, QR expansion, answer then submit, views/privacy, skip/replay/dismissal, and no side effects. Run existing full suite and browser flow. Independent final review; commit/push and verify Development only.

## Ledger
- Ruling: user gave concrete corrective design direction; implement this revision within the already-approved tour scope without another approval loop. Starter-test/account persistence remains unchanged.
- Verification: RED missing screenshot target, then GREEN full interactive flow on 390px viewport; QR expansion, student answer/submit/confirmation, receipt, private results/export simulation, Back/Skip/Escape, persistence/replay and zero real sessions/popups covered. Build/check and all 34 automated tests passed; full browser smoke passed. Independent review found no actionable issues. Twelve screenshots total about 452KB, generated solely from fictional local fixture data.
