# Brag Plan: sub20

## What is this app?
sub20 is a running-plan PWA ("Plan treninga za 5K, 10K, polumaraton i maraton — po Danielsovoj VDOT metodologiji") that turns one recent race result into a full, paced training plan and then tells you, honestly, how far you still are from your goal.

## The angle
The app is literally named after one second: 19:59. Yet when you type 19:59 as your goal, it doesn't cheer — it answers like a coach who won't lie to you: "Cilj je sačuvan kao želja." Every training pace stays tied to confirmed form, and the progress screen ends with "Procena nije obećanje." The video sells exactly that: a plan built from your real number, and an honest read on the gap.

## Hook (first 2-3 seconds)
A race clock in the app's light display numerals counts 19:55 → 19:59 on the eighth notes and stops on the beat, turning green. Line: "Jedna sekunda."

## Key moments (the middle)
- One real result in: wizard step "Šta si poslednje istrčao?" — 21:30 is typed into the real min/sek fields.
- Goal 19:59 typed into "Ciljno vreme — opciono"; the app's own warning card answers. Everything dims except "Cilj je sačuvan kao želja".
- Tap "Napravi plan" → the plan: "Tvoj plan · 5K · Nedelja 1 od 13 · 19,6 km", scroll to the week's rows ("Fartlek 4× 30 s @ 4:34/km · 6 km", "Lako", "Dugo (LR)").
- Weeks 2 → 8 of the real plan flick past (one per sixteenth note); then, with one 3 km test entered: "Da li napredujem? — Da ▲ VDOT +2,2", the journey bar fills 21:29 → 20:38, "Do cilja 19:59 fali 39 s."

## Outro / punchline
Push into the app's own footnote, which becomes the closing line: "Procena nije obećanje." Then a green flood, the sub20 mark fills in, wordmark and "sub-19.vercel.app".

## User flow worth showing
Entry: wizard step 2 — enter last result (21:30) → Key action: wizard step 4 — enter goal 19:59, the app answers honestly, tap "Napravi plan" → Result: the generated 5K plan, and seven weeks later the Forma screen showing the measured gap to 19:59.

All screens were captured from the real app (built from this repo, `web/`, run locally against a mocked backend, light theme, Pixel-width 412 px at 3x). Data is a fictional demo runner (5 km 21:30 on 10.01.2026, 35 km/week, goal 19:59, race 12.04.2026, one 3 km test of 11:40 on 04.03.2026). No real user data, emails or tokens appear.

## Tone
- Preset: polished → re-cut faster on request ("ovo je sport brzine, oštriji cutovi")
- Creative direction: the honest coach, cut like a race — the app's own "Quiet Athlete" design language, hard cuts and whips on a 120 BPM grid
- Interpretation: flat light ground, ink type, one green accent; every cut on a beat, entrances 0.1–0.25 s, titles dead still once landed; the humor stays dry and comes only from the app's own copy ("sačuvan kao želja", "nije obećanje").

## Format: vertical — 1080x1920 (a reel; text and product inside the 168–1330 px band)
## Duration: 20.0 s (10 bars at 120 BPM)

## Visual identity (from the project, web/src/styles/tokens.css)
- Background: #f6f7f5 (--bg)
- Accent: #335e35 (--accent; also the app icon ground)
- Text: #19251e (--text); secondary #46554b (--text-2); hairline #e0e5de (--line)
- Display font: Figtree (bundled in web/src/styles/fonts, weights 300–900); big numbers at weight 300 like the app's hero numerals
- Body font: Figtree
- Strongest visual element: the app's huge light numerals (6,5 km / 19,6 km / 21:29) and the Forma "journey" bar from start to goal

## Share copy (draft)
Aplikacija se zove sub20, a tvoj cilj od 19:59 čuva „kao želju" dok ga ne potvrdiš testom. Jedan rezultat unutra, ceo plan napolje — i iskrena procena koliko ti još fali.

## Audio direction
- Role: driving bed with sparse, action-matched accents
- Music: happy-beats-business-moves-vol-1 (bundled, "most energetic", 120.19 BPM), entered at 13.02 s of the track so its louder section B starts on the logo cut (video 2.0 s)
- Music treatment: fade-out 1.0 s under the end card; final file loudness-normalized to −14 LUFS (two-pass loudnorm)
- Music cue guidance: preset read (`assets/music/cues/happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.json`). Video-time beats every 0.5 s, bars at 0, 2, 4 … 18. Strong locks: 2.0 (logo), 7.0 (warning card), 9.0 (tap "Napravi plan"), 13.0/13.5 (Forma, "Da"), 14.0 (bar lands).
- Audio-reactive treatment: none, on purpose — the app's design system forbids glow and pulsing.
- SFX posture: clock ticks on eighths, a soft impact on the stop and on the logo cut, clicks on taps, key ticks on digits, ticks on the week flips, one accent on "Da", one payoff hit on the mark.
- Restraint rule: no risers, no whoosh on every cut.

## Storyboard (v2, 20.0 s)

### Scene 1 — Race clock — 0.00–2.00 s
"19:55" at frame 0; the last digit rolls up on every eighth note (0.25 s) to "19:59" and stops on the beat (1.0 s), turning #335e35 with one punch. "Jedna sekunda." 1.1–2.0. Hard cut.

### Scene 2 — Logo — 2.00–4.00 s
Hard cut on the downbeat: the real app icon and "sub20" slam in (1.14 → 1 in 0.22 s); "Trkački plan" (manifest name) on the next beat. Whip up.

### Scene 3 — One result — 3.90–6.00 s
Wizard step 2 whips in from below; cursor taps "min" on 4.5, types 21; taps "sek" on 5.0, types 30. Whip left.

### Scene 4 — The honest answer — 5.90–9.35 s
Goal field whips in from the right; 19:59 typed (taps on 6.25 and 6.5). The real warning card slams in on 7.0; all but "Cilj je sačuvan kao želja" dims at 7.25. Tap "Napravi plan" on 9.0 and zoom through the green button.

### Scene 5 — The plan — 9.35–11.50 s
Hard cut out of the green: Plan tab week 1 settles; fast smeared scroll to the day rows on 10.0.

### Scene 6 — Weeks fly — 11.50–13.00 s
Real Plan headers, weeks 2 → 8, one per sixteenth note; week 8 ("Nedelja 8 od 13 · RAZVOJ · 23,1 km") lands at 12.25.

### Scene 7 — Forma — 13.00–16.00 s
Hard cut on the bar: "Da li napredujem?"; "Da ▲ VDOT +2,2" slams on 13.5; the bar fills 21:29 → 20:38 and lands on 14.0; "Do cilja 19:59 fali 39 s." Veils, fast push into "Procena nije obećanje."

### Scene 8 — Punchline + end card — 16.00–20.00 s
"Procena nije obećanje." slams in on the bar and holds 1.5 s; hard cut to green on 17.5; the mark fills, "sub20" and "sub-19.vercel.app" hold to 20.0.
