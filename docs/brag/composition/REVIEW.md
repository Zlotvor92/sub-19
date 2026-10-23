# Review — sub20 brag reel (v2, fast cut)

## Creative calls
- v2 re-cut on request ("brže, oštriji cutovi"): 24.0 s → 20.0 s, 120 BPM track (vol-1) instead of vol-12, hard cuts / whips / zoom-through on the beat grid, race-clock hook (19:55 → 19:59), "7 nedelja kasnije" replaced by the real Plan headers of weeks 2–8 flicking past.
- Story unchanged: the app named after 19:59 saves that goal "kao želja" and ends its estimate with "Procena nije obećanje."
- Real UI only: captures of the running app (mocked backend, fictional demo runner). Weeks 2–8 captured by pressing "Sledeća nedelja" in the app.

## Measured vs looked at
- `hyperframes check`: 0 errors, 0 warnings (lint, runtime, layout, contrast 9/9, craft).
- Snapshots of every scene and transition read; decoded frames of the final file checked.
- Render: 20.0 s, 600 frames, 30 fps. Audio measured, not heard: renderer mix −24.4 LUFS → two-pass loudnorm (dynamic) to −14.1 LUFS, peak −1.2 dB. Re-renders come out quiet again until that step is repeated.
- Poster: frame at 1.5 s (green "19:59 / Jedna sekunda.") baked as frame 0.

## Weakest shot
13.0–13.5 s: "Da li napredujem?" with an empty space until "Da" lands half a second later. With more time: land "Da" on the cut itself and use the half beat for the bar.

## Warnings kept on purpose
- None open. Audio-reactive treatment intentionally absent (the app's design system forbids glow/pulse).
