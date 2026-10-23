# Hyperframes Composition Brief: sub20

## Objective
Create a short launch-style brag reel for sub20, the running-plan app in this repository.

## Output
- Composition directory: `docs/brag/composition/`
- Rendered video: `docs/brag/brag.mp4`
- Format: vertical — 1080x1920, 30 fps
- Duration: 20.0 s (v2 fast cut)

## Source Material
- Project root: `/home/user/sub-19` (React/Vite PWA in `web/`)
- Primary files read: `web/public/manifest.json`, `web/index.html`, `web/src/styles/tokens.css`, `web/src/features/onboarding/*`, `web/src/features/race/FormScreen.tsx`, `web/e2e/support/*.ts`, `web/public/uputstvo.html` (public URL), `web/public/icon-512.png`
- Product name: sub20 (manifest: "sub20 · Trkački plan")
- Tagline / strongest claim: "Plan treninga za 5K, 10K, polumaraton i maraton — po Danielsovoj VDOT metodologiji." (manifest description)
- Key UI to show: real screen captures (3x) of wizard step 2 (result), step 4 (goal + warning card + "Napravi plan"), Plan tab week 1, Forma "Da li napredujem?" before/after a 3 km test.
- Copy that must appear verbatim (all from the app/manifest):
  - Plan treninga za 5K, 10K, polumaraton i maraton
  - Šta si poslednje istrčao?
  - Cilj je sačuvan kao želja
  - Da ▲ VDOT +2,2 / Do cilja 19:59 fali 39 s.
  - Procena nije obećanje.
  - sub-19.vercel.app

## Creative Direction
- Tone preset: polished, re-cut fast (hard cuts and whips on a 120 BPM grid)
- Creative direction: the honest coach — quiet premium product film in the app's own "Quiet Athlete" design language
- Interpretation: flat light ground, ink type, one green accent; arrivals on long-tailed eases, titles dead still once landed; humor only from the app's own copy.
- Angle: The app is named after one second (19:59), yet it saves your 19:59 goal "kao želja" and keeps every pace tied to confirmed form; seven weeks later it shows exactly how much is still missing. Honest > hype.
- Hook: race clock 19:55 → 19:59, stop — "Jedna sekunda."
- Outro / punchline: "Procena nije obećanje." → sub20 mark + sub-19.vercel.app
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign (no dark void, glow, gradients, shadows, glass — the app's tokens forbid them)

## Visual Identity
- Background: #f6f7f5
- Text: #19251e (secondary #46554b)
- Accent: #335e35
- Display font: Figtree (copied from `web/src/styles/fonts/`, latin + latin-ext subsets, 300–900)
- Body font: Figtree
- Visual references from the project: huge weight-300 numerals, hairlines #e0e5de, pill buttons in #335e35, warn cards #f6ead2 with #8a5600 bar.

## Storyboard
Use the storyboard in `docs/brag/brag-plan.md` as the creative contract.

Scene summary (v2):
1. Race clock — 0.0–2.0 s — 19:55 → 19:59, "Jedna sekunda."
2. Logo — 2.0–4.0 s — app icon, "sub20", "Trkački plan"
3. One result — 3.9–6.0 s — wizard step 2, typing 21:30
4. The honest answer — 5.9–9.35 s — goal 19:59, warning card, highlight "Cilj je sačuvan kao želja", tap "Napravi plan", zoom through
5. The plan — 9.35–11.5 s — Plan tab week 1, scroll to rows
6. Weeks fly — 11.5–13.0 s — Plan headers weeks 2 → 8
7. Forma — 13.0–16.0 s — "Da ▲ VDOT +2,2", bar 21:29 → 20:38, "fali 39 s"
8. Punchline + end card — 16.0–20.0 s — "Procena nije obećanje.", green, mark, URL

## Audio
- Audio role: warm bed with sparse, action-matched accents
- Audio arc: soft intro → opens on the reveal → tactile typing → one warm accent on "Da" → payoff hit on the mark → fade out
- Music: `assets/music/happy-beats-business-moves-vol-1-by-ende-dot-app.mp3` (Music: Sascha Ende, ende.app, CC BY 4.0)
- Music treatment: media start 13.02 s, fade-out 1.0 s; final file normalized to −14 LUFS
- Music cue guidance: bundled preset `cues/happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.json`; beats every 0.5 s; strong locks at 2.0, 7.0, 9.0, 13.5, 14.0 (video time)
- Audio-reactive treatment: none — documented brand reason (flat surfaces, no glow/pulse in the app's design system)
- Audio-coupled moments:
  - Scene 1 — digit roll — one soft tick
  - Scenes 3–4 — typed digits — soft key ticks; taps — clicks
  - Scene 6 — "Da" — warm accent
  - Scene 7 — mark fill — payoff hit
- SFX selection guidance: low high-frequency-risk Kenney picks (`interface/click_00x`, `ui/click2`, `interface/bong_001`, `impact/impactSoft_medium_00x`, `impact/impactBell_heavy_000` quiet)
- SFX analysis guidance: `~/.claude/skills/brag/assets/sfx/sfx-analysis.md`
- Exact SFX choice: chosen after the animation exists
- Audio files: copied into `composition/assets/music/` and `composition/assets/sfx/`

## Hyperframes Instructions
Built with the current `hyperframes` skill (contract, format, motion, sound, review) and `hyperframes-cli` (lint/check/snapshot/render) from heygen-com/hyperframes at CLI 0.8.189. /brag owns the story; no Hyperframes storyline interview.

Requirements:
- Show real UI (screen captures of the running app).
- Keep all text readable; nothing meant to be read outside 168–1330 px.
- 20.0 s total.
- Music + sparse SFX.
- `hyperframes check` before render.
- Local creation and render only.
