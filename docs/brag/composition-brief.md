# Hyperframes Composition Brief: sub20

## Objective
Create a short launch-style brag reel for sub20, the running-plan app in this repository.

## Output
- Composition directory: `docs/brag/composition/`
- Rendered video: `docs/brag/brag.mp4`
- Format: vertical — 1080x1920, 30 fps
- Duration: 19.65 s (v3 race concept)

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
- v3 concept: "Ovaj reel je trka na 5 km" — race clock HUD, a green split card per kilometre, app shots between splits, finish at 19:59.
- Tone preset: chaotic, disciplined as a sport broadcast; hard cuts on the beat, slams, no fades.
- Hook: green start screen "5K / cilj 19:59 / 00:00"; gun on beat 2.
- Outro: the clock stops at 19:59 → mark, "sub20", "sub-19.vercel.app".
- Avoid: generic SaaS language, invented UI, the app's forbidden effects (glow, gradients, shadows).

## Visual Identity
- Background: #f6f7f5
- Text: #19251e (secondary #46554b)
- Accent: #335e35
- Display font: Figtree (copied from `web/src/styles/fonts/`, latin + latin-ext subsets, 300–900)
- Body font: Figtree
- Visual references from the project: huge weight-300 numerals, hairlines #e0e5de, pill buttons in #335e35, warn cards #f6ead2 with #8a5600 bar.

## Storyboard
The contract is `docs/brag/brag-plan.md` (v3) and `composition/SPEC.md`.

## Audio
- Audio role: warm bed with sparse, action-matched accents
- Audio arc: soft intro → opens on the reveal → tactile typing → one warm accent on "Da" → payoff hit on the mark → fade out
- Music: `assets/music/happy-beats-business-moves-vol-10-by-ende-dot-app.mp3` (Music: Sascha Ende, ende.app, CC BY 4.0)
- Music treatment: media start 17.47 s, fade-out 1.0 s; final file normalized to −14 LUFS
- Music cue guidance: bundled preset `cues/happy-beats-business-moves-vol-10-by-ende-dot-app.music-cues.json`; beats every 0.5457 s; gun 1.09, splits 4.37 / 7.64 / 10.91 / 14.19, finish 17.46
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
- 19.65 s total.
- Music + sparse SFX.
- `hyperframes check` before render.
- Local creation and render only.
