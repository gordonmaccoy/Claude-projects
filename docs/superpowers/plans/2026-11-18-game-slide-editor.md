# Fixed game slide editor — 2026-11-18

Approved direction: fixed PowerPoint-style game editor. Preserve the existing game schema, import paths, AI review and launch behavior.

1. Add behavior tests for navigation, duplication/reordering, hidden-question validation, preview and responsive bounds.
2. Replace the long question form with a thumbnail rail, one selected question canvas and properties panel. Retain existing title/folder/save/import IDs and routes.
3. Validate the whole draft before save. Preserve answer IDs during moves; create fresh IDs during duplication. Preview locally without launching a session.
4. Verify existing browser flow, new editor flow, syntax and server suite. Review changes; release to the authorized Public deployment.

Ruling: use a bounded editor workspace without viewport-relative height inside the auto-sizing professor iframe, preventing height feedback loops. Small screens stack the properties panel and use a horizontal thumbnail rail.

Verification ledger:
- New behavior tests first failed because the editor module did not exist, then passed.
- Full regression suite: 374 passed, 0 failed (.tmp/editor-suite.log).
- Focused editor unit suite after review fixes: 3 passed.
- Chrome library integration: passed desktop/mobile, themes, imports, AI review, duplicate IDs, persisted reordering, preview images, and delayed image upload save guard.
- Syntax checks and git diff --check passed.
- Fresh review identified persisted image-media validation, asynchronous upload/save race, and missing option-image previews. All three corrected and covered by focused tests.
- Ruling: preview presents question content and reveal locally, without playing external media or launching a live session. Existing game timing/scoring remains unchanged.

- Follow-up review: AI review and pending image upload race guarded at request start and response application; delayed-response Chrome test passed.
