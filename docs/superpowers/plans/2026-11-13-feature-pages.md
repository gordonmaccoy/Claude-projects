# Feature pages implementation plan

Create four branded public pages under /features/: monitoring, classroom-views, grading-ai, and games. Replace the landing Features anchor with a native accessible disclosure dropdown shared on these pages. Retain the existing homepage feature overview and link cards to relevant pages.

Use supplied GIFs and existing product screenshots, with short readable sections and icons. Monitoring explains actual optional page-hidden failure, focus/fullscreen events, browser restrictions and professor override. Three views explains private professor/public classroom/student roles. Grading/AI explains editable generation/import, weighted grading, corrections, detailed results and exports. Games is a plainly labeled coming-soon roadmap page with a concept illustration, no enabled game controls or announced date.

Responsive shared styling and navigation, keyboard dismissal, optional GIF pause controls/reduced-motion handling, descriptive image alternatives and Korean UI/content translations. Static HTML content remains readable without JavaScript. Test page routes/assets/copy, dropdown keyboard/mobile behavior, page overflow, view interaction and animation controls. No auth, exams or grading behavior changes.

Validation: focused feature/landing tests and syntax checks pass. Feature browser checks four routes, loaded media, desktop/mobile overflow, keyboard disclosure dismissal, GIF pause, view selection, Korean and reduced motion. Existing polish browser passes. All four full-page renders visually inspected. Independent review found no blockers; motion-preference changes are handled. No game functionality implemented.
