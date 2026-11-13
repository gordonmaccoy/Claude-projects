# Examio editor and classroom polish

Implement the requested editor readability, creation navigation, classroom presentation, and result export changes.

- Spell out bold Question labels and bold question text; shade selected answer keys green and other choices red.
- Creation choices have bold titles, icons, descriptions; Upload a Quiz follows Create manually. Back preserves title/folder. Selected files can be cleared.
- Launch buttons remain blue; setup and editor stay white in blue theme.
- Repair the malformed classroom stylesheet URL and share a styled pause message with the student page.
- Place End beside Start/Pause. Keep Delete results visible, with confirmation explaining that active sessions end before moving results to Trash.
- Detailed PDFs use a full-width colored landscape matrix, repeated headers, question averages, and an answer-key appendix. Exams over 25 questions use A3 landscape for readability; smaller exams use A4 landscape. Summary PDFs stay portrait.

Validation: 76 automated tests pass; syntax checks pass; standalone browser integration passes for editor, creation navigation, themes, classroom styles, pause messages, and active/ended result deletion. Dense 50-question PDF rendered and visually inspected, including Korean names and footer averages.
