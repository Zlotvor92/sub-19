# SUB-20 · Instagram reel — paket za objavu

Fajlovi u `docs/reel/out/`:

| Fajl | Šta je |
| --- | --- |
| `sub20-reel.mp4` | gotov reel, 1080 × 1920, 30 fps, H.264 + AAC, 28,8 s, sa originalnom muzikom |
| `sub20-reel-bez-zvuka.mp4` | isti video bez zvuka — ako hoćeš da dodaš zvuk iz Instagram biblioteke |
| `cover.png` | naslovnica 1080 × 1920 (Reels) |
| `cover-4x5.png` | ista naslovnica isečena na 1080 × 1350 (4:5, mreža profila) |
| `muzika.wav` | samo muzika (originalna, sintetizovana u kodu — nema autorskih prava) |

## Tekst objave (kopiraj)

```
Da li napredujem? Pitanje koje sebi postavlja svaki trkač.

SUB-20 odgovara jednom rečenicom, ne gomilom grafikona:
• Danas: tačan tempo, struktura i trajanje treninga
• Plan: ceo ciklus, od baze do trke
• Oporavak: kaže kad da usporiš
• Napredak: procena forme, jasno odvojena od merenja

Plan po Danielsovoj VDOT metodi, radi i bez interneta, uvoz sa Strave.

Aplikacija je besplatna i ostaće besplatna. 🏁
Link u bio.

(Podaci na ekranu su demo.)
```

Kraća varijanta (ako hoćeš manje teksta ispod videa):

```
Da li napredujem? SUB-20 odgovara jednom rečenicom.
Tempo za danas, ceo ciklus do trke i signal kad treba da usporiš.

Besplatna je i ostaće besplatna. Link u bio. 🏁
(Podaci na ekranu su demo.)
```

## Hashtagovi (izaberi 8–12, ne sve)

`#trcanje #trkanje #5k #sub20 #planzatrcanje #trkackaaplikacija #trcanjesrbija #trkaci #polumaraton #maraton #vdot #jackdaniels #oporavak #hrv #trening #runningapp #runnersofinstagram`

## Tekst na ekranu (već je u videu) i vreme

| Vreme | Scena | Tekst | Ekran |
| --- | --- | --- | --- |
| 0,0–2,4 | Uvod | „Da li napredujem?" / „Svaki trkač se to pita." | prsten štoperice se crta |
| 2,4–7,2 | Napredak | „SUB-20 ti odgovori." / „Odgovor, ne gomila grafikona." | „Da ▲ VDOT +1,1" → osa start–sada–cilj (20:13 → 19:59) |
| 7,2–12,0 | Danas | „Znaš šta trčiš danas." / „Ciljni tempo, struktura, trajanje." | 4:00 /km, profil 7 × 60 s |
| 12,0–16,8 | Plan | „Ceo ciklus pred tobom." / „Baza, razvoj, vrhunac, taper, trka." | traka ciklusa, faze |
| 16,8–21,6 | Oporavak | „Kaže ti kad da usporiš." / „Stanje iz HRV-a, sna i opterećenja." | „Olakšaj", savet |
| 21,6–26,4 | Brend | „SUB·20" / „Plan za 5K, 10K, polumaraton i maraton" | Danielsova VDOT metoda · radi i bez interneta · uvoz sa Strave |
| 26,4–28,8 | Poziv | „Isprobaj SUB-20" / „Link u bio" | nova ikona |

Pokazivač napretka na vrhu je traka ciklusa iz aplikacije (12 segmenata); svaki segment je 2,4 s, tj. jedan takt muzike (100 BPM).

## Opcioni voiceover (≈ 25 s, tempo mirno)

1. „Da li napredujem? Svaki trkač se to pita."
2. „SUB-20 ti odgovori. Jedna rečenica: forma raste, procena danas dvadeset trinaest, cilj devetnaest pedeset devet."
3. „Znaš šta trčiš danas — tempo, strukturu, trajanje."
4. „Vidiš ceo ciklus, od baze do trke."
5. „A kad HRV padne i san je kratak, kaže ti da usporiš."
6. „SUB-20. Plan za pet kilometara, deset, polumaraton i maraton. Link u bio."

## Preporuke za objavu

- **Naslovnica:** u Instagramu izaberi „Dodaj sa uređaja" pa `cover.png`; mreža profila prikazuje 4:5 isečak, koji je gotov u `cover-4x5.png` (pitanje i odgovor su u njemu cele).
- **Zvuk:** poslovni nalozi imaju ograničenu biblioteku muzike (pravila se menjaju — proveri za svoj nalog). Priložena muzika je originalna, sintetizovana u kodu, bez tuđeg materijala. Ako ipak želiš trend-zvuk, uvezi `sub20-reel-bez-zvuka.mp4` i dodaj ga u aplikaciji.
- **Bezbedna zona:** glavni sadržaj je između 280 px odozgo i 1540 px (380 px odozdo slobodno); to je praktična preporuka, Instagram je ne garantuje. Sitna napomena „demo podaci" je tik ispod.
- **Titl:** u videu nema govora, pa je sve čitljivo i bez zvuka.
- **Demo podaci:** ekrani su iz stvarne aplikacije, ali sa izmišljenim planom (5K, nedelja 6 od 12) i izmišljenim merenjima. Ostavi napomenu „podaci su demo" u opisu (već je u tekstu iznad) i ne predstavljaj brojeve kao rezultate stvarnog korisnika.
- **Provera tvrdnji:** „radi i bez interneta" proverava e2e test (otvaranje iz keša bez mreže); „uvoz sa Strave" je u Podešavanjima → Strava; „Danielsova VDOT metoda" je u opisu aplikacije. „Besplatna i ostaće besplatna" stoji u opisu po tvojoj izjavi kao vlasnika; u samom videu to ne piše (ako hoćeš, dodajem red na završnu scenu).
- **Link:** Instagram ne aktivira linkove u opisu ni u komentarima — stavi adresu aplikacije u bio (ili Linktree). Ne znam tačnu adresu, pa je u videu samo „Link u bio".

## Ponovno pravljenje

```bash
# aplikacija mora da bude izgrađena i servirana na :4173
(cd web && npm run build && npx vite preview --port 4173 --strictPort &)
node docs/reel/capture.mjs        # snimci iz prave aplikacije (demo podaci) + merenje položaja elemenata
node docs/reel/audio.mjs          # muzika
node docs/reel/render.mjs --full  # video, verzija bez zvuka, naslovnica
```

Izmena teksta ili vremena je u `docs/reel/reel.html` (`SC` = naslovi po scenama, `BEATS` = oznake na ekranu); video je čista funkcija vremena `render(t)`, pa isti ulaz uvek daje isti kadar.
