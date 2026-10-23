# Review — sub20 brag reel (v3, "Ovaj reel je trka na 5 km")

## Creative calls
- New concept from scratch on request (v1/v2 were a linear walkthrough): the reel is a 5 km race. A broadcast-style clock runs from the gun to 19:59, a green split card hits every kilometre, the app flies by between splits in hard cuts on the beat, and the clock stops at 19:59 on the finish.
- Split times on the cards (3:59 / 7:59 / 11:59 / 15:59) and the clock are the video's framing (even sub-20 pace), not app data; every app screen is a capture of the real app (mocked backend, fictional demo runner). New captures: weeks 9-13 including "Faza TRKA: Dan trke" and the race-day row, and the "Tvoja forma" panel from wizard step 2.
- Music changed to vol-10 ("compact loop, punchy"), entered where every beat is a strong cue.

## Measured vs looked at
- `hyperframes check`: 0 errors, 0 warnings (lint, runtime, layout, contrast 12/12, craft).
- Snapshots of every shot and of each split; decoded frames of the final file checked.
- Render: 19.65 s, 590 frames, 30 fps. Audio measured, not heard: renderer mix −23.7 LUFS → two-pass loudnorm to −14.1 LUFS, peak −1.3 dB. Re-renders come out quiet until that step is repeated.
- Poster: the finish frame (18.6 s: mark, "19:59", "sub20", address) baked as frame 0.

## Weakest shot
10.37-10.91 s: the race-day row ("Nedelja 12 · TRKA · 5 km") is real but visually thin for a payoff beat. With more time: punch-in on "TRKA" with the week-13 header behind it.

## Warnings kept on purpose
- None open. The HUD clock text changes every frame by design (a function of time, deterministic on seek).
