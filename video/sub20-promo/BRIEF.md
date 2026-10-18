---
workflow: product-launch-video
flow: automation
storyboard: yes
message: "Sat ti kaže vreme, Sub-20 ti pokazuje gde gubiš sekunde."
destination: reels
aspect: 1080x1920
language: sr-Latn
audience: "rekreativni trkači koji jure 5 km ispod 20 minuta"
length: 42-50s
angle: "priča sa likom i metaforom (sekunde su lik), a ne poster sa brojevima"
vo_mode: restructured
---

## Intent

Vertikalni promo za Sub-20 (PWA za trkački trening). Priča problem → rešenje kroz lik:
sjajna narandžasta kugla nosi trkačevo vreme na 5 km, „kradljivci sekundi" je jedu,
Sub-20 ih vraća. Tek posle priče dolazi proizvod (pravi UI u kadru). Ton: topao, siguran,
malo razigran. Naracija na srpskom (latinica), glas ElevenLabs Eleven v4.

## Assets

- video/reference.mp4 — referentni klip za STIL (ne sadržaj). Ne postoji u repou u trenutku pravljenja briefa.
- Snimci ekrana prave aplikacije (demo stanje, 390×844 @3×) — `capture/screens/`.

## Customizations

- Sjajne kugle (radijalni gradijent, odsjaj gore levo), gooey topljenje/kapanje (SVG filter, deterministički).
- Likovi od prostih oblika sa dva oka: treptaj, poskok, ugriz kao isečak kruga.
- Tipografija: grotesk za naslove + akcenat-reči u kurzivnom serifu, u akcent boji.
- Ručno nacrtan krug i kvačica (stroke-dashoffset), rotiran pečat.
- Prelazi: pretvaranje oblika i match-cut; brzi pan sa motion blurom za ulaz u UI. Nikad fade-out pa fade-in.
- Opciono finale: 3D prolet kroz kadrove + kartica „Napravljeno sa AI".

## Notes

- Checkpoint posle storyboarda + skripte: bez ElevenLabs poziva pre odobrenja.
- TTS preko ElevenLabs konektora (`eleven_v4`), ne preko HeyGen/Kokoro pipeline-a (korisnik, 2026-10-18).
- Odobreno 2026-10-18: narandžasta kugla, Figtree, kradljivac 1 = četvrti kilometar, 3D prolet ulazi.
- Muzika: DA (korisnik, 2026-10-17: „Dodaj muziku sam imaš tu opciju"). HeyGen biblioteka nije dostupna (nije prijavljen). Izvor: originalna numera sintetizovana u kodu (kao `docs/reel/audio.mjs`), bez ElevenLabs kredita i bez tuđeg materijala (korisnik: „imaš opciju da sam generišeš muziku, već si to radio nekoliko puta"). Lagana, razigrana, spuštena ispod naracije (ducking). Zvučni efekti (pop, gulp, kapljica, whoosh) takođe sintetizovani u kodu.
- Samo funkcije koje postoje u kodu, svaka sa putanjom. Bez obećanja rezultata, bez izmišljenih korisničkih brojeva, bez emotikona, bez stock fotografija ljudi.
- Bez tajni i ličnih podataka u kadru (tokeni, emailovi, Strava ID-jevi).
- Safe zona za Reels: ključni tekst između ~220 px i ~1600 px po visini, ne u desnih ~120 px.
- Ne menjati kod aplikacije; sve u `video/sub20-promo/` (`video/` je u `.gitignore`).
