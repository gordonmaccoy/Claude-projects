# Examio motion tours — approved direction

Five caption-only tours use fresh actual Examio screens and fictional classroom data. Smooth zooms, cursor movement and click highlights explain actions without narration or music. Deliver landscape 1920×1080 MP4 walkthroughs (~45–75 seconds) and separately composed vertical 1080×1920 Instagram versions (~20–30 seconds). These durations are production targets; captions must remain readable.

## Sequences
1. Launch: choose quiz; settings or Quick Launch saved preferences; QR login; start; brief public activity display; submit and see score/corrections; finish.
2. Monitoring: live status; optional five-second hidden-page failure; event review; professor unlock; pause; public activity can be hidden while private monitoring continues.
3. Create: manual/upload/generate/paste choices; edit questions and correct answers; organize; save.
4. Results: responses update while students answer; summary and detailed views; final grades; PDF/Excel exports.
5. Games: choose game; Classic Solo or Team Race; settings; QR and avatars; team joining/naming; start; answers and rankings; podium; saved report. Explain average member points in Team Race.

## Approach
Selected: real application captures composed into animated caption-only walkthroughs. Unedited recordings would contain distracting delays; invented UI animation could misrepresent the app. Reuse existing local PGlite/Playwright capture infrastructure, with updated fixtures and selectors. No production account data or paid AI calls for recordings.

## Integration
Replace current screenshot tour with a five-video picker and accessible native video controls. No autoplay on page load. Pause when closed; keyboard escape and focus restoration; caption transcript fallback. Retain existing onboarding dismissal storage. Contextual entry on each relevant workspace section. Instagram files remain downloadable artifacts, not posted automatically.

## Quality
Refresh outdated wording in the old tour. Do not imply fullscreen is compulsory or focus changes independently cause failure. Show the five-second rule enabled for that demonstration. Scores/corrections and game scoring must match recorded settings. No meaningful text cropped in vertical editions. Inspect representative frames and full playback before publishing.
