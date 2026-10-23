GOAL:    a runner who wants sub-20 feels the reel *is* their 5 km race, sees sub20 turn one result into every pace and a plan to race day, and leaves with the name and the address.
OUTPUT:  HyperFrames, 1080 x 1920, 30 fps (vertical reel)
TIME:    19.65 s x 30 = 590 frames; music 109.96 BPM (vol-10 entered at 17.47 s) = 16.4 frames per beat (B = 0.5457 s)
LOOK:    two grounds from the app's tokens: #f6f7f5 for app shots, #335e35 full-bleed for start, splits, sprint and finish.
         Ink #19251e on light, white on green. Figtree 300 at 300-330 px for clocks and split times (the app's hero-number weight),
         Figtree 700 at 150-240 px for "5K", "N KM", "sub20". Real UI captured at 3x, shown at 2.5-4x CSS size. No shadows, glow, gradients.
OBJECTS: the race clock (HUD pill: "5K" + mm:ss, distance bar with 4 km ticks); split cards; the app's own screens.
MOTION:  hard cuts on beats or sixteenths only; every shot slams in (scale 1.05-1.2 -> 1, 0.15-0.2 s, expo.out); landed text dead still;
         the clock and distance bar are linear functions of time; the clock freezes on the split while a split card is up.
SHOTS:   0.00-1.09  start: "5K", "cilj 19:59", "00:00" on green. Gun 1.09.
         1.09-4.37  21:30 typed (sixteenths) | Tvoja forma 45,8 (2.18) | punch-in, paces pop on eighths (3.27-4.09).
         4.37-4.91  split 1 KM 3:59.
         4.91-7.64  Tvoj plan | Danas 6 km Fartlek 4× 30 s @ 4:34/km | week rows.
         7.64-8.19  split 2 KM 7:59.
         8.19-10.91 weeks 1-13 on sixteenths (week 13 at 9.83) | race row "TRKA 5 km" (10.37).
         10.91-11.46 split 3 KM 11:59.
         11.46-14.19 goal 19:59 | "Cilj je sačuvan kao želja" (12.01) | "Da ▲ VDOT +2,2" + bar fill (13.10).
         14.19-14.73 split 4 KM 15:59.
         14.73-17.46 Forma bar | "Do cilja 19:59 fali 39 s." (15.28) | "Procena nije obećanje." (15.82) | sprint: full-screen clock (16.92).
         17.46-19.65 finish: 19:59 stops, mark, "sub20", "sub-19.vercel.app".
BANNED:  dark void; glow/bloom/particles; gradients/glass; shadows; fades between scenes; slow pushes; invented UI or product claims;
         audio-reactive pulsing; the logo docked in a corner.
QA:      0.5 (start), 1.95 (21:30), 3.9 (paces), 4.4 (split + HUD 03:59), 6.0 (Danas), 9.3 (week flip), 10.6 (TRKA), 12.6 (želja),
         13.6 (Da), 15.5 (fali 39 s), 17.43 (sprint 19:59), 19.06 (end card).
