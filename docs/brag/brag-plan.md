# Brag Plan: sub20 — v3 „Ovaj reel je trka na 5 km"

(v1/v2 — the walkthrough "honest coach" cut — are in git history.)

## What is this app?
sub20 is a running-plan PWA ("Plan treninga za 5K, 10K, polumaraton i maraton — po Danielsovoj VDOT metodologiji") that turns one recent result into a paced plan through race day and tracks the gap to your goal.

## The angle
The reel *is* a 5 km race. A race clock runs from 00:00 the whole time, broadcast-style; every kilometre is a hard green split card ("1 KM · 3:59"); between splits, the app flies by in sharp cuts — one result in, every pace out, 13 weeks to race day, an honest read on form. The clock stops at 19:59 on the finish: sub20.

## Hook (first 2-3 seconds)
Green ground, giant white "00:00", "5K · cilj 19:59" (the app's own header copy). Gun on beat 2 (1.09 s) — the clock starts and never stops.

## Key moments (the middle)
- 0 → 1 km: "Šta si poslednje istrčao?" — 21:30 types in; "Tvoja forma 45,8 — jedan broj iz kog se računa svaki tempo u planu"; paces Lako 5:30 · Tempo 4:34 · Interval 4:07 · Rep 3:58 pop one per eighth.
- 1 → 2 km: "Tvoj plan · 5K · za 88 dana"; today "6 km Fartlek 4× 30 s @ 4:34/km"; the week's rows.
- 2 → 3 km: weeks 1 → 13 flip one per sixteenth; "Nedelja 13 od 13 · Faza TRKA: Dan trke."; the row "Nedelja 12 · TRKA · 5 km".
- 3 → 4 km: goal 19:59; the app's card "Cilj je sačuvan kao želja"; "Da ▲ VDOT +2,2".
- 4 → 5 km: "Do cilja 19:59 fali 39 s."; "Procena nije obećanje."; final sprint — the clock fills the screen.

## Outro / punchline
Clock stops on the bar at 19:59. Mark, "sub20", "sub-19.vercel.app".

## User flow worth showing
Result in (wizard step 2) → paces (Tvoja forma) → plan (Plan tab, Danas) → 13 weeks to race day → form check (Forma).
All screens are captures of the real app from this repo, run locally with a mocked backend and a fictional demo runner (5 km 21:30, 35 km/week, goal 19:59, race 12.04.2026, one 3 km test 11:40). The split times on the cards and the clock are the video's race framing, not app data.

## Tone
- Preset: chaotic → disciplined (sport broadcast)
- Creative direction: a 5 km race broadcast — running clock, split cards, finish
- Interpretation: a new shot every beat (0.55 s) or faster, hard cuts only, slams instead of fades, numbers huge; the app's green/white palette carries it; no jokes added — the app's honest copy stays the only dry note.

## Format: vertical — 1080x1920 (reel; HUD and product inside 168–1330 px)
## Duration: 19.65 s (9 bars at 110 BPM)

## Visual identity (from web/src/styles/tokens.css)
- Ground: #f6f7f5 for app shots; #335e35 (accent, app icon ground) full-bleed for start, splits and finish
- Text: #19251e on light, #ffffff on green
- Display: Figtree 300 for the giant clock (the app's hero-number weight), Figtree 700 for "1 KM" and "sub20"
- Strongest visual element: the running clock and the app's huge light numerals

## Share copy (draft)
Ovaj reel je trka na 5 km. sub20 od jednog tvog rezultata napravi svaki tempo i plan do dana trke — a sat staje na 19:59.

## Audio direction
- Role: driving bed + broadcast hits
- Music: happy-beats-business-moves-vol-10 ("compact loop, punchy", 109.96 BPM), entered at 17.47 s where every beat is a strong cue; fade-out 1.0 s; final file normalized to −14 LUFS
- Music cue guidance: preset `cues/happy-beats-business-moves-vol-10-by-ende-dot-app.music-cues.json`; video beats every 0.5457 s; gun 1.09, splits 4.37 / 7.64 / 10.91 / 14.19, finish 17.46 (bar)
- Audio-reactive treatment: none (the app's design system forbids glow/pulse)
- SFX: heavy soft impact on the gun and the finish, medium impact on each split, key ticks on typed digits and pace pops, ticks on week flips (eighths), one accent on "Da", bell on the stopped clock
- Restraint rule: no risers or whooshes; hits only where the picture hits

## Storyboard (video seconds; beat = 0.5457 s)
1. Start — 0.00–1.09 — green, "00:00", "5K · cilj 19:59". Gun at 1.09.
2. Km 0→1 — 1.09–4.37 — result typed (1.09–2.18); Tvoja forma panel (2.18–3.27); paces pop on eighths (3.27–4.37).
3. Split "1 KM · 3:59" — 4.37–4.91
4. Km 1→2 — 4.91–7.64 — "Tvoj plan" (0.55 s), Danas Fartlek (1.1 s), week rows (1.1 s).
5. Split "2 KM · 7:59" — 7.64–8.19
6. Km 2→3 — 8.19–10.91 — weeks 1→13 on sixteenths, week 13 holds, "TRKA · 5 km" row slams.
7. Split "3 KM · 11:59" — 10.91–11.46
8. Km 3→4 — 11.46–14.19 — goal 19:59 (0.55 s), "Cilj je sačuvan kao želja" (1.1 s), "Da ▲ VDOT +2,2" + bar fill (1.1 s).
9. Split "4 KM · 15:59" — 14.19–14.73
10. Km 4→5 — 14.73–17.46 — "fali 39 s" bar (1.1 s), "Procena nije obećanje." (1.1 s), sprint: clock full screen (0.55 s).
11. Finish — 17.46–19.65 — "19:59" stops, mark, "sub20", "sub-19.vercel.app".
