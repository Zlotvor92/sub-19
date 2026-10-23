# Brag Plan: sub20

## What is this app?
sub20 is a running-plan PWA ("Plan treninga za 5K, 10K, polumaraton i maraton — po Danielsovoj VDOT metodologiji") that turns one recent race result into a full, paced training plan and then tells you, honestly, how far you still are from your goal.

## The angle
The app is literally named after one second: 19:59. Yet when you type 19:59 as your goal, it doesn't cheer — it answers like a coach who won't lie to you: "Cilj je sačuvan kao želja." Every training pace stays tied to confirmed form, and the progress screen ends with "Procena nije obećanje." The video sells exactly that: a plan built from your real number, and an honest read on the gap.

## Hook (first 2-3 seconds)
A giant "20:00" in the app's light display numerals. On the first beat it rolls to "19:59". Line: "Jedna sekunda."

## Key moments (the middle)
- One real result in: wizard step "Šta si poslednje istrčao?" — 21:30 is typed into the real min/sek fields.
- Goal 19:59 typed into "Ciljno vreme — opciono"; the app's own warning card answers. Everything dims except "Cilj je sačuvan kao želja".
- Tap "Napravi plan" → the plan: "Tvoj plan · 5K · Nedelja 1 od 13 · 19,6 km", scroll to the week's rows ("Fartlek 4× 30 s @ 4:34/km · 6 km", "Lako", "Dugo (LR)").
- Seven weeks later (one 3 km test entered): "Da li napredujem? — Da ▲ VDOT +2,2", the journey bar fills 21:29 → 20:38, "Do cilja 19:59 fali 39 s."

## Outro / punchline
Push into the app's own footnote, which becomes the closing line: "Procena nije obećanje." Then a green flood, the sub20 mark fills in, wordmark and "sub-19.vercel.app".

## User flow worth showing
Entry: wizard step 2 — enter last result (21:30) → Key action: wizard step 4 — enter goal 19:59, the app answers honestly, tap "Napravi plan" → Result: the generated 5K plan, and seven weeks later the Forma screen showing the measured gap to 19:59.

All screens were captured from the real app (built from this repo, `web/`, run locally against a mocked backend, light theme, Pixel-width 412 px at 3x). Data is a fictional demo runner (5 km 21:30 on 10.01.2026, 35 km/week, goal 19:59, race 12.04.2026, one 3 km test of 11:40 on 04.03.2026). No real user data, emails or tokens appear.

## Tone
- Preset: polished
- Creative direction: the honest coach — quiet premium product film in the app's own "Quiet Athlete" design language
- Interpretation: flat light ground, ink type, one green accent; slow-arriving, dead-still titles; the humor is dry and comes only from the app's own copy ("sačuvan kao želja", "nije obećanje"), never from added jokes.

## Format: vertical — 1080x1920 (a reel; text and product inside the 168–1330 px band)
## Duration: 24.0 s (11 bars at ~110 BPM)

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
- Role: warm bed with sparse, action-matched accents
- Music: happy-beats-business-moves-vol-12 (bundled, "steady and clean", 109.96 BPM), entered at 6.55 s of the track so its section change lands on the reveal (video 2.19 s) and section C lands at 8.74 s
- Music treatment: ~0.32 volume, 0.3 s fade-in, 1.5 s fade-out under the end card
- Music cue guidance: preset read (`assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json`). Video-time bars: 0.01, 2.19, 4.38, 6.56, 8.74, 10.92, 13.11, 15.29, 17.47, 19.65, 21.82. Strong cues to lock: 2.19 (reveal), 12.01 (plan opens), 16.38 ("Da" lands). Typing ticks are fast UI events, not beat-gridded.
- Audio-reactive treatment: none, on purpose — the app's design system forbids glow, gradients and pulsing ("Površine su ravne: bez stakla, gradijenata i senki"), and pulsing loops read as generated.
- SFX posture: sparse, motion-matched: soft key ticks on typed digits, a click on each cursor tap, one warm accent when "Da" lands, one payoff hit when the mark fills.
- Audio-coupled moments: typed 21:30 and 19:59; tap on "Napravi plan"; "Da ▲ VDOT +2,2"; end mark.
- Restraint rule: no risers, no whooshes on every cut, nothing bright or repeated loudly.

## Storyboard

### Scene 1 — Hook — 0.00–2.19 s
Giant "20:00" (Figtree 300, ink) already on screen at frame 0. On beat 0.54 the digits roll like a slot machine to "19:59" and settle dead still. "Jedna sekunda." blurs in at 1.09 and holds.
Sequential/interaction: yes — digit roll 20:00 → 19:59.
Audio intent: quiet start of the bed, a single soft tick on the roll.
Audio-coupled idea: tick on the roll landing.
Music: track intro, soft.
Transition mood: soft → blur swap on the same stage into Scene 2.

### Scene 2 — Reveal — 2.19–5.47 s
On the strong cue 2.19 the real app icon (green mark) lands; "sub20" wordmark letters in; line "Plan treninga za 5K, 10K, polumaraton i maraton." (manifest copy, verbatim) holds ~2.7 s.
Sequential/interaction: wordmark per letter.
Audio intent: the music opens up here (track section B).
Audio-coupled idea: none (music change carries it).
Transition mood: clean → vertical whip up into Scene 3.

### Scene 3 — One result — 5.47–7.65 s
Real wizard step 2 crop: "KORAK 2 OD 4 / Šta si poslednje istrčao? / Bilo koja skorija trka… Iz ovog jednog rezultata računa se svaki ciljni tempo u planu." with 5 km selected. Big cursor enters, taps "min", types 21; taps "sek", types 30.
Sequential/interaction: yes — simulated taps and typing (real empty → real filled field pixels).
Audio intent: tactile, close.
Audio-coupled idea: soft key tick per digit, click per tap.
Transition mood: clean → horizontal push (like the wizard advancing) into Scene 4.

### Scene 4 — The honest answer — 7.65–12.01 s
Real "Ciljno vreme — opciono" field; cursor types 19:59. On 8.74 the app's real warning card lands below: "Ciljno vreme 19:59 je brže od reference trenutne forme (21:30)… Cilj je sačuvan kao želja…". Everything in the card dims except "Cilj je sačuvan kao želja" (hold ≥1.9 s). Cursor taps the real "Napravi plan" button.
Sequential/interaction: yes — typing, card arrival, dim-to-highlight, button tap.
Audio intent: a beat of dry humor — the music keeps going, nothing dramatizes the warning.
Audio-coupled idea: ticks on digits, click on the button.
Transition mood: iris opens from the button tap onto Scene 5.

### Scene 5 — The plan — 12.01–15.29 s
Real Plan tab: "Tvoj plan / 5K · nedelja, 12. aprila · za 88 dana / Nedelja 1 od 13 / week strip with 14 selected / 19,6 km". The screen scrolls (one smooth move) to the rows: "Danas • sreda — Fartlek 4× 30 s @ 4:34/km · 6 km", "Odmor", "Lako 5,6 km · 5:29 /km", "Odmor", "Dugo (LR) 8 km · 5:37 /km".
Sequential/interaction: yes — simulated scroll.
Audio intent: one soft impact as the plan opens on 12.01.
Audio-coupled idea: plan opening on the strong cue.
Transition mood: soft → blur swap to a chapter line.

### Scene 6 — Seven weeks later — 15.29–19.65 s
Chapter line "7 nedelja kasnije" (framing). Then the real Forma section: "Da li napredujem? ● Procena". On 16.38 "Da ▲ VDOT +2,2" lands; "Procena za 5K danas: 20:38. Do cilja 19:59 fali 39 s." holds; the journey bar fills from 21:29 to the 20:38 dot, goal tick at 19:59. Camera pushes to the footnote line "…Procena nije obećanje."
Sequential/interaction: yes — answer lands, bar fills, push-in.
Audio intent: a warm single accent on "Da".
Audio-coupled idea: accent on the "Da" landing.
Transition mood: push-in → the footnote becomes Scene 7's line.

### Scene 7 — Punchline + end card — 19.65–24.00 s
"Procena nije obećanje." large, dead still, ~1.6 s. Colour flood to #335e35; the real app mark fills upward on 21.82; "sub20" wordmark and "sub-19.vercel.app" hold to the end (≥2 s).
Sequential/interaction: flood → mark fill → wordmark → URL.
Audio intent: payoff hit on the mark, music fades out under the end card.
Audio-coupled idea: payoff hit on the mark.
Transition mood: colour flood.

**Music mood for this video:** steady, clean, warm
**Audio summary:** a soft intro that opens on the reveal, tactile ticks and clicks while the user types, one warm accent on "Da", one payoff hit on the mark, fade out under the end card.
