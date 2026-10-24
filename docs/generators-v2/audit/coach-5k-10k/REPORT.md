# Ugao 1a — trenersko čitanje 5K v2 i 10K v2

Kod: `670700e` (`git diff --stat 670700e HEAD -- web/` prazan pre merenja i pre izveštaja). Bez izmena u `web/`.
Politike: `5k-v2.10.4`, `10k-v2.8.1`. Slučajnost: nema — svi ulazi su fiksni u skriptama (seed nije potreban);
uzorci mreža su deterministički (svaki k-ti ulaz `lib.DISTS[..].all()` od pomaka 0).

## Šta je mereno

| skripta | 5K | 10K |
|---|---|---|
| `coach.ts` → `coach-5K.md`, `coach-10K.md` | 14 generisanih (2 × profil korisnika, 3/4/5 d — 6 dana 5K ne postoji, policy `days`), 2 trčanje/hodanje, 6 adaptiranih, 4 predaje HM → 5K (kraj ned 8 i ned 2 × činjenice izvora none/under50) | 13 generisanih (3/4/5/6 d), 1 trčanje/hodanje (očekivano odbijanje D29), 6 adaptiranih, 4 predaje maraton → 10K |
| `measure.ts` (M1, M4: generator; M2/M3: adaptacija) | 3 816 ulaza (k = 1, svi), 5 170 tokova adaptacije (k = 60; pain5/pain8/painPause/pause20/under50; asOf sreda i kraj ned 2…N−2) | 10 374 ulaza (k = 3 od 31 122), 7 900 tokova adaptacije (k = 400, isti scenariji i asOf) |
| `note-mixed.ts` (potvrda M2) | 3 816 / 60 baza × pain5/pain8/painPause: nedelja napomene tekuća ili buduća | — |

Pokretanje (iz `web/`):
```
node ../docs/generators-v2/audit/coach-5k-10k/coach.ts 5K  > ../docs/generators-v2/audit/coach-5k-10k/coach-5K.md
node ../docs/generators-v2/audit/coach-5k-10k/coach.ts 10K > ../docs/generators-v2/audit/coach-5k-10k/coach-10K.md
node ../docs/generators-v2/audit/coach-5k-10k/measure.ts 5K 1 60    > ../docs/generators-v2/audit/coach-5k-10k/measure-5K.json
node ../docs/generators-v2/audit/coach-5k-10k/measure.ts 10K 3 400  > ../docs/generators-v2/audit/coach-5k-10k/measure-10K.json
node ../docs/generators-v2/audit/coach-5k-10k/note-mixed.ts
```

Automatske zastavice u `coach.ts`: skok dugog (> max(1,25×, +2 km)) i cilja (> 12 % i > 2,5 km) u izgradnji, isti
kvalitet zaredom, izgradnja bez kvaliteta, lagan > 0,9 × dugi, dan kvaliteta duži (min) od dugog, lagan/dugi < 3 km
(taper/trkačka < 2 km), teški dani zaredom.

## Nalazi

Klase po `briefs/00-common.md`. B: nijedan — 0 bacanja, 0 praznih treninga, 0 „dugi < lagan", 0 treninga ispod
minimuma (3 km / taper 2 km) u svim pročitanim planovima; sve odbijanje je dokumentovano (10K trčanje/hodanje D29).

| ugao | distanca | broj | ulaz koji reprodukuje | uzrok | klasa | predlog |
|---|---|---|---|---|---|---|
| 1a | 10K | M1: 2 912 / 10 374 planova (28 %) imaju lagan = dugi (± 0,05 km) u nedelji izgradnje; M5: 974 plana / 6 426 nedelja lagan ≥ 0,95 × dugi DAN PRE dugog | `d4-14w-50km-v45-A-sun` (mreža 02; 4 d, 50 km, VDOT 45): ned 3, 5–7, 9, 10, 12 subota lagan 17,1 km (100 min) + nedelja dugi 17,1 km (100 min); isto u predaji MAR → 10K (`coach-10K.md`, ned 3–8); `d3-8w-25km-v30-A-sat` ned 6 lagan 12,5 = dugi 12,5 | `tenK/v2/lengths.ts:36` dugi = min(udeo, 105 min sporim E), `:45` lagani = ostatak ≤ dugi (jednako dozvoljeno); upozorenje samo CAPACITY_LIMITED/WEEK_FITTED kad cilj padne | T | Kad bi lagan dostigao ≥ ~0,9 × dugi: cilj nedelje ide naniže (planirano < cilj, uslov 3) ili preporuka više dana; bar ne lagan = dugi dan pre dugog |
| 1a | 5K | M1: 634 / 3 786 (16,7 %) lagan = dugi u izgradnji (1 090 sa ≥ 0,95); M5: 308 planova / 741 nedelja dan pre dugog | `coach-5K.md` 3d-veliki-v50-12w (3 d, 30 km): ned 5, 6, 8, 9 lagan 14,8–15,1 / dugi 15,5; `r-d4-6w-35km-v32-0` | `fiveK/v2/lengths.ts:31-32` dugi = udeo cilja (45/35/30 %), ostatak u lagane ≤ dugi (`week.ts:148` easyCappedAtLong) | T | isto kao gore |
| 1a | 10K | M4: 6 516 / 9 950 (65 %) trkačkih nedelja: dan oštrenja ≥ 1,5 × najduži lagan te nedelje; max 4,5× | `d5-13w-45km-v70-A-sat`: ned 13 tri lagana po 3,0 km (12 min) + oštrenje 13,5 km (52 min) u četvrtak pred trku u subotu; `coach-10K.md` 6d-veliki-brz-v68 ned 16 oštrenje 13,3 km / lagan 7,3; 5d-srednji-v48 ned 14 10,7 / 4,9 | `tenK/v2/policy.ts:74` (D8: WU/CD oštrenja po pojasu D14 = 25 + 15 min; ostali dani ≤ lagan tapera, D23); `week.ts:703` | T | WU/CD oštrenja u trkačkoj nedelji vezati za lagan trkačke (npr. 10–15 min), ne za pojas izgradnje |
| 1a | 10K / 5K | M6: lagan < 20 min u izgradnji: 10K 1 116 / 10 374 (min 12:18), 5K 326 / 3 786 (min 13:52) | `d5-13w-45km-v70-A-sat` (VDOT 70 = rub realnog): lagani 3,0–5,9 km (12–24 min) uz kvalitet 12–16,5 km; `d3-8w-20km-v55-A-sat`; 5K `r-d3-6w-12km-v45-0` | 10K: minimum lagana 3 km po km, ne po vremenu (`policy.ts:123`, Uslov 8); WU/CD pojas D14 jede obim (svesno: `policy.ts:199`) | T | minimum laganog i u minutima (≈ 20–25 min) ili manje dana; delimično poznato (10K `policy.ts:199`) |
| 1a | 5K | 1 114 / 5 170 tokova (21,5 %) bola/pauze: napomena „planirano X km < cilj obima" ≠ planirano nedelje, samo u tekućoj (mešovitoj) nedelji (`note-mixed.txt`: 1 112 tekuća, 0 buduća) | `coach-5K.md` bol 5 sreda ned 5 (asOf 2026-12-02): napomena 29,08, planirano 27,78; `r-d3-6w-12km-v32-0`/painPause@2026-11-18 ned 3: 9 vs 10,12 | `fiveK/v2/week.ts:154` (broj iz sastavljene nedelje) + `written.ts:56-60` (dani ≤ asOf vraćeni, plannedKm ponovo izračunat, napomene `b.notes` zadržane) | T (tekst) | napomenu sastaviti posle `writtenWeek` (ili bez broja, kao 10K „planirano ≤ cilj obima") |
| 1a | 5K | 2 221 / 5 170 tokova (43 %): napomena „Rasterećenje: …" u nedelji koja nije rasterećenje (faza peak/sharpen) | `coach-5K.md` bol 5 ned 5–6, pauza 20 ned 8, pauza 35 ned 8 („Adaptacija: jedan kvalitet, doza rasterećenja. / Rasterećenje: jedan kratak kvalitet."); u ned 5 bola vidljiv je jedini kvalitet I 3 × 700 (urađen, puna doza) | `fiveK/v2/workouts.ts:988`, `feel.ts:395` (graditelj doze rasterećenja piše napomenu i kad ga zove ograničenje adaptacije) | K | napomena „Rasterećenje" samo kad `w.deload`; inače samo „Adaptacija: jedan kvalitet, doza rasterećenja" |
| 1a | 10K | 1 tok (bazni plan); obrazac pauze 35 | `coach-10K.md` pauza 35 kraj ned 7 (bazni 4 d 35 km VDOT 45 14 ned, asOf 2026-12-20): ned 9 i 11 T 2 × 1000 dan 8,2 km / 45 min > dugi 6,2 km / 36 min (ned 11: 43 min); lagani 3,0–3,5 km; ned 10 rasterećenje bez kvaliteta posle 2 ned povratka; taper bez kvaliteta, trkačka bez oštrenja | upozorenja postoje (LONG_SHORTER_THAN_QUALITY, DELOAD_NO_QUALITY, TAPER_NO_QUALITY); WU/CD 20 + 15 min (D14) | T (poznata klasa N5 HM/MAR) | isto kao N5; za 10K: posle nov start bez rasterećenja u 3. nedelji povratka |
| 1a | 5K | 1 tok; obrazac pauze 35 | `coach-5K.md` pauza 35 kraj ned 6 (bazni 4 d 30 km VDOT 45 12 ned): ostalo 6 ned — 1 ned baze (15 km), 2. ned „peak" sa I 2 × 600, 1 ned oštrenja, 2 ned tapera (15,4 / 12,7) + trkačka 7,6; lagani u taperu/trkačkoj 2,2–2,7 km (13–16 min) | `fiveK/v2/policy.ts:285` taperMinKm 2,0 dozvoljava; taper 2 ned nepromenjen posle nov starta | T | posle nov starta skratiti taper na 1 ned; lagani < ~20 min → dan odmora |
| 1a | 5K | profil korisnika (1 plan, 2 rasporeda) | `coach-5K.md` KORISNIK 20:25, cilj < 20:00, 13. 12. 2026, 30 km, 4 d: vidi „Činjenice vs mišljenje" | — (prolazi pravila; cilj označen „ambiciozan") | T (mišljenje) | vidi detalj |
| 1a | 5K | 1 plan | `coach-5K.md` trcanje-hodanje-e480-3d-12w: L12 (30 min) od ned 8, ned 8–11 jedanaest istih sesija; trka 5 km bez hodanja ≈ 40 min (E 8:00) > najduže trčanje 30 min | lestvica završava na L12 (`fiveK/v2/policy.ts:385`); prelaz na kontinuirani plan tek uz ≥ 6 ned (`transitionMinWeeks`) | T (blago) | L13+ (35–40 min) ili prelaz na kontinuirani plan i sa < 6 ned |
| 1a | 5K | 1 plan (+ ista pravila u svim početnicima) | `coach-5K.md` pocetnik-4d-e420-12w: prvi kvalitet ikad u rasterećenju (ned 3, usponi), drugi = test 3 km RPE 9–10 (ned 4) | `fiveK/v2/feel.ts` / početnik „1 kvalitet od ned 3", test u ned 4 | T (mišljenje) | test posle bar 2 obična kvaliteta |
| 1a | 5K | svi 5K planovi (107 pojava u `coach-5K.md`) | „T: 2.5 km", „Lagano 9.64 km", „Cilj trkačke nedelje = planirano 12.16 km (gornja granica 17.5 km = 50% vrha …)", „oporavak 240 s"; 10K/HM pišu „2,5 km", „4:00"; 10K „traži 0.3 VDOT" | formatiranje naslova/napomena 5K (`workouts.ts`, `week.ts`) | K | decimalni zarez, 1 decimala, oporavak u m:ss |

## Činjenice vs mišljenje po nalazu

**Profil korisnika (5K, 20:25 → < 20:00, trka 13. 12. 2026, start 19. 10., 30 km, 4 d, 2 kvaliteta).**
Činjenice (plan, uto/čet/sub/ned): VDOT 48,6; tempo T 4:21, I 4:00, R 3:45, RP 4:05 (= 20:25; cilj 4:00/km nije tempo
treninga — „tempo treninga ostaje prema rezultatu", cilj „ambiciozan", jaz 1,3 VDOT). Obim 30 → 32,4 → 34,9 (vrh =
1,16 × start; kapacitet 46,7) → 27,9 R → 34,9 → taper 29,7 / 24,4 → trkačka 12,2 + trka. I samo u ned 3 i 4 (2 × 1000 m
= 2,0 km = 5,7 % nedelje; Daniels plafon I 8 % ≈ 2,8 km); RP 2 × 1000 (ned 5–6), 2 × 800 (ned 7); oštrenje 3 × 400 RP u
četvrtak, sub 4 km + ubrzanja. Raspored pon/sre/pet/ned isti obim i doze. Nijedna zastavica, nijedno upozorenje osim
GOAL_STATUS.
Mišljenje (trener): plan je bezbedan i ispravno raspoređen (teški dani razdvojeni, dugi 10,5–12,2 km ≈ 35 %, taper
bez naglog pada), ali za skidanje 25 s je rad na VO2max/RP tanak: jedna puna nedelja vrha (ned 3), rasterećenje već u
ned 4 osmonedeljnog plana za trkača koji već trči 30 km, pa 2 nedelje tapera (3 od 8 nedelja sniženog obima). Trener
bi: bez rasterećenja ili blago u ned 4, I 4–5 × 800–1000 m (do plafona 8 %), RP 4–5 × 1000 m, taper 1 nedelja.
Potpisao bi ga kao „održavanje / mali napredak", ne kao plan za < 20:00. Nalaz je mišljenje; pravila koda plan ne krši.

**Lagan = dugi (5K, 10K).** Činjenica: pravilo dozvoljava lagan ≤ dugi (jednako); dugi ima plafon udela i (10K) 105 min.
Kad je obim veći od onoga što dugi + kvalitet nose, višak ide u lagane. Mišljenje: dva trčanja od 100 min dan za danom
(subota lagan, nedelja dugi) u 10K planu 4 dana nije „lagan dan" — trener bi tražio 5. dan ili manji obim.

**Oštrenje 10K.** Činjenica: D8 — WU/CD oštrenja po pojasu D14 (25 + 15 min za brze/veći obim), ostali dani trkačke
≤ najkraći lagan tapera (D23), pa je dan oštrenja često 2–4,5× lagan iste nedelje. Mišljenje: 3 × 1000 RP je u redu,
ali 40 min WU/CD 2–3 dana pred trku nije.

**Napomene 5K adaptacije (M2, M3).** Činjenica: brojevi iz `measure-5K.json` / `note-mixed.txt`. Napomena tekuće
nedelje nosi broj iz sastavljene nedelje pre vraćanja zaštićenih dana; „Rasterećenje: …" stoji u nedelji faze
peak/sharpen. Mišljenje: korisnik vidi kontradikciju (dve tvrdnje o rasterećenju, pogrešan broj).

**Nepotvrđeno / nije nalaz:** 10K tekst napomena nema broj (0 neslaganja); B klasa — ništa nađeno u 46 pročitanih
planova (5K 26, 10K 24 sa predajama) ni u 13 160 tokova merenja (5 170 + 7 900, 0 bacanja, 0 odbijanja).


## Već poznato (nije prijavljeno kao novo)

- Predaja: cilj počinje od obima iz čarobnjaka izvora (HM 40 / maraton 50 km), ne od stvarnog obima izvora (HM ned 8
  planirano 42,9, vrh 56 km), a činjenice izvora `under50` (manjak u poslednjoj nedelji izvora) daju plan identičan
  `none` (5K i 10K, obe tačke predaje). To je odluka `handoff/DESIGN.md` P2 („obim = čarobnjak izvora"; „pauza/bol/
  manjak ulaze samo kroz adaptaciju"). Mišljenje: trener bi posle 8 nedelja HM pripreme krenuo od stvarnog obima; ovde
  samo beležim, nije novo.
- Platoi (5K posle HM ned 2: 42,3 km ned 2–11 = 10 nedelja; vrh = kapacitet 42,3 km za VDOT 45 / 4 d) — klasa
  „platoi" u ODLUKE-4a N12.
- 10K/5K 3 dana: rasterećenje bez kvaliteta (DELOAD_NO_QUALITY, 10K 3d-mali-v40 ned 5), početnik 3 d bez oštrenja u
  trkačkoj (10K pocetnik-3d-v35 ned 12) — isti obrazac kao HM „3 d 25 km bez RP na kraju" (N12).
- 10K pauza 35 = isti obrazac kao HM/MAR „pauza 35" u `final-check/coach-notes.md` (N5); ovde samo nove činjenice za 10K (T4).
