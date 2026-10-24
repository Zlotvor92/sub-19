# QA izveštaj — „Nitrati i trčanje“ (finalna verzija, 24. 10. 2026)

## Zaključak

Sve tehničke provere su prošle. Slušanje uhom (glas, muzika, efekti) nije urađeno; umesto njega korišćene su
objektivne zamene: ASR transkripcija, merenje glasnoće i spektrogrami. Pre objave potrebna je ljudska provera slušanjem.

## Tehničke specifikacije (ffprobe, finalni MP4)

| Stavka | Zahtev | Izmereno |
|---|---|---|
| Rezolucija / format | 1080×1920, 9:16 | 1080×1920 |
| Frejmovi | 30 fps | 30/1, 2430 frejmova |
| Trajanje | 75–85 s | 81,000 s |
| Video | H.264, yuv420p | H.264 High, nivo 4.2, yuv420p, BT.709 oznake, ~3,05 Mb/s |
| Audio | AAC | AAC LC, 48 kHz, stereo, ~264 kb/s |
| Faststart | da | redosled atoma `ftyp → moov → free → mdat` (moov pre mdat) |
| Vodeni žig | ne | nema |

## Zvuk

| Stavka | Cilj | Izmereno (ebur128, finalni MP4) |
|---|---|---|
| Integrisana glasnoća | ≈ −14 LUFS | −14,1 LUFS |
| True peak | ≤ −1 dBTP | −1,8 dBTP |
| LRA | — | 3,2 LU |
| Ducking muzike ispod glasa | da | −7 dB, attack 0,15 s, hold 0,9 s, release 0,7 s |
| Završetak muzike | čist, namerni | završni akord na 79,2 s, kosinusni fade; rep −46 dB |

## Govor i titlovi

- Probni snimak i obe take su transkribovani pomoću ElevenLabs Scribe. To je posredna provera izgovora reči
  nitrati, nitriti, azot-monoksid, ekonomičnost i milimola.
- U probi je reč „korišćena“ prepoznata kao „korištena“, pa je rečenica preformulisana.
- Finalni miks je transkribovan ponovo: svih 148 reči odgovara scenariju. Vremena reči odstupaju od vremenske
  linije titlova najviše 0,02 s.
- Titlovi: 26 događaja, najviše 2 reda, Inter 600 50 px, ključni pojmovi istaknuti bojom.
- Ograničenje: ASR potvrđuje da je reč razumljiva, ali ne i da prirodno zvuči (naglasak, intonacija).

## Slika

- Crni frejmovi (`blackdetect d=0.05 pix_th=0.05`): 0.
- `freezedetect` (n=0.001, d=1 s) prijavljuje tri mirnija prozora: 17,47 s (1,43 s), 55,1 s (1,5 s) i 64,63 s (1,1 s).
  - Ručna provera razlike prvog i poslednjeg frejma u svakom prozoru pokazala je da se slika menja u svakom
    od njih (11–26 hiljada promenjenih piksela).
  - Promene dolaze od titlova, kazaljke sata i bakterija, pa to nisu zamrznuti kadrovi.
- Bezbedna zona (levo 90 / desno 180 / gore 200 / dole 320 px):
  - Proverena na listovima kadrova sa simuliranim Instagram dugmadima i natpisom (`scripts/qa_frames.py`).
  - Tekst i ključni elementi su unutar zone.
  - Ivicu prelaze samo pozadinski elementi i linija staze, što je namerno.
- Prelazi su provereni na kadrovima oko svakog reza:
  - čestica → molekul
  - molekul vodi u telo
  - linija krvnog suda → linija staze
  - krug → sat
  - kraj ponavlja početnu kompoziciju

## Sadržaj i hemija

- Putanja NO₃⁻ → NO₂⁻ → NO. Simboli se crtaju kao SVG strelice i indeksi, jer korišćeni podskup fontova nema
  glifove → i ≈.
- Formulacije su „može“ i „kod nekih trkača“. Nema doping okvira, garancija ni izmišljenih grafikona i procenata.
  Prikaz metabolizma je označen kao „Ilustracija“.
- Laboratorijski test do iscrpljenja je odvojen od testa na zadatu distancu (Poon i sar. 2025).
- Ne prikazuje se porast eritrocita, a cvekla ne „postaje kiseonik“.
- Doza:
  - „6–8 mmol nitrata“, „≈ 370–500 mg“, „2–3 sata pre napora“, oznaka „Primer sportskog protokola“.
  - AIS navodi raspon 6–10 mmol (≈ 350–650 mg), a 6–8 mmol je unutar njega.
- Vodica za usta je pomenuta. Nema sugestije da se preskače pranje zuba.

## Naslovnica i opis

- `nitrati_trcanje_cover.jpg`: 1080×1920, sa naslovom „NITRATI I TRČANJE“ i podnaslovom „Kako zapravo deluju?“.
  Ključni sadržaj je u centralnom isečku 1080×1350.
- `caption_sr.txt`: 2101 znak (Instagram ograničenje je 2200), sa punim referencama i heštegovima.
