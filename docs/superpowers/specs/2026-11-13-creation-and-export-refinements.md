# Creation, exports and appearance refinements

User requested consistent white test/folder surfaces and white buttons in blue mode, right-aligned folder handles, larger left Start/Pause and right End controls, a classroom theme toggle, professor-controlled classroom language, result export options and a clearer test-creation popup.

Creation offers manual, AI generation, pasted existing questions and document extraction. No Excel/code import. Generate accepts a topic and/or PDF/DOCX; true/false uses two-choice MC. Paste/extract use one AI toggle and submit action, with explicit AI consent. Preserve title/folder, clear stale file/text, prevent duplicate requests and abort on cancellation/account change. File limits stay at 5 MB and supported formats remain PDF/DOCX.

Download opens Summary/Detailed columns with Excel, PDF and email actions. Email defaults to the signed-in address and permits editing (implementation default while optional preference question remains unanswered). It sends only after an explicit click. Owner checks protect exports; email has input validation, bounded rate and idempotency. Delivery requires Railway Public RESEND_API_KEY and EXPORT_FROM (or CONTACT_FROM). Existing key reuse is awaiting user approval; missing configuration disables email while leaving downloads available.

PDF exports bundle licensed Noto Sans KR for reliable Korean text and pin the canvas renderer dependency explicitly. Visual render checks cover Korean and multi-page output. A reproduced Windows native access violation in PDF import led to subprocess isolation, keeping size/text/time/heap limits, safe errors and one retry for abnormal native exits. Actual PDF/DOCX extraction and crash containment have regression tests.

New creation/export modals close and clear private state when authentication changes. Classroom receives language from the session and has an independent remembered theme, with no language picker. Public release only; legacy production configuration remains unchanged.

Follow-up: user selected signed-in-email-only delivery. Recipient is read-only and server derives it from the verified user, rejecting a supplied different address. User approved creating a separate sending-only key scoped to examio.io because the previous secret was no longer retained. RESEND_API_KEY and EXPORT_FROM are configured only in Railway Public; no credentials are stored in source.
