# Review — sub20 brag reel

## Creative calls
- Story owned by /brag (no Hyperframes storyline interview): the app named after one second (19:59) that saves your 19:59 goal "kao želja" and ends its estimate with "Procena nije obećanje."
- Vertical 1080x1920 (a reel), polished tone, the app's own "Quiet Athlete" tokens; real UI captured from the running app (mocked backend, fictional demo runner), laid on the same ground as the app.
- Not built: a landscape cut; a voiceover; a version showing logged runs/Strava.

## Measured vs looked at
- `hyperframes check`: 0 errors, 0 warnings (lint, runtime, layout, contrast 13/13, craft).
- Snapshots: QA frames, `snapshot --review` (beats, 12 seams, phone sheet at 360 px) — read and fixed: blurred frame 0, misaligned goal-field capture, placeholder remnants while typing, end-card mark colliding with the outgoing line, footnote push-in off target, chapter line and closing lines under their read floors.
- Render: 24.0 s, 720 frames, 30 fps, h264 + aac. Audio measured, not heard: the renderer's mix came out at −24.3 LUFS, so the delivered file got a two-pass loudnorm (dynamic) to −14.0 LUFS, true peak −1.0 dBTP. Re-renders of this project come out quiet again until that step is repeated.
- Poster: frame at 1.6 s ("19:59 / Jedna sekunda.") baked as frame 0.

## Weakest shot
Scene 5 (plan): after the scroll the lower half of the frame is empty and the rows are small (2.4x CSS). With more time: punch-in on the "Danas • sreda — Fartlek 4× 30 s @ 4:34/km" row instead of a plain scroll.

## Warnings kept on purpose
- None open. Audio-reactive treatment intentionally absent: the app's design system forbids glow/pulse.
