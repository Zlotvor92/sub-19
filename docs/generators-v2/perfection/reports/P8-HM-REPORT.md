# P8-HM — ispravke po slepoj oceni i glavnom treneru — hm-v2.11.0

10. 11. 2026 (Europe/Belgrade). Polaz `0181e25` (hm-v2.10.0). Zadaci `briefs/P8-ispravke-po-slepoj-oceni.md` i
`briefs/P8-dopuna-po-glavnom-treneru.md` (dopuna ima prednost). Izmene samo `web/src/domain/generators/halfMarathon/v2/**`
i dokumentacija; `halfMarathon/` van `v2/` (zamrznut v1) nije diran. Otvorene odluke: `reports/P8-HM-STOP.md` (S1–S6).

## Šta je ugrađeno (policy.ts P8-G1 … P8-G3, P8-HMb; heuristike, odluka organizatora P8)

| pravilo | mesto (jedan vlasnik) | sadržaj |
|---|---|---|
| G4 | `quality.capM` (član minuta), `capSec`; `policy.caps.workSec` | T ≤ 30 min (cilj ≥ 80 km: 40), I ≤ 20 min za VDOT < 40 inače 24, RP usred nedelje ≤ 45 min; blok u dugom bez minuta |
| G5 | `workouts.sharpenerRepM`; `quality.deloadDose` | oštrenje 2 jednake deonice, ≤ 12 min rada, deljivo sa 100 m, 400–2000 m; rasterećenje ≈ 60 % poslednje T doze (3 dana: ne doze slota) |
| G1 | `volume.peakCap10`, `peakHoursCap10`, `step10`, `growLeft` | vrh = min(H6; start × 1,30 / 1,35 / 1,40 po dužini; 7,5 / 8,5 / 9,5 h po VDOT-u); korak = min(H6; ostatak / preostale ne-rasteretne nedelje do kraja razvoja); korak < 3 % se ne primenjuje |
| G2 | `quality.capM` (`floorM`), `ladderCapM`; `week.taperDoseFits` | prvi nivo lestvice uvek staje (izgradnja, taper); u taperu samo kad nedelja može da se sastavi |
| G7 | `periodize.testWeekOf`; `week.buildWeekIn` | test je jedini kvalitet nedelje; ne pre nedelje 4 (inače plan bez testa, napomena) |
| G6 | `lengths.buildEasyCap10` (pravilo plana `easyLongMaxShare`) | lagan ≤ 0,70 × dugi za 4+ dana (3 dana 0,80) |
| HM (b) | `specific.chooseBlockKm`, `rpTimeShareOk` | RP trening + blok ≤ 22 % vremena nedelje; ne staje → manji blok ili nedelja A |
| G3 | `week.ts` napomene, `userText.ts` | napomena testa (šta sa rezultatom), bloka, tapera (najmanja doza); bez reči sastavljanja u korisničkom tekstu |
| HM (a) | — (rešava G4) | dan kvaliteta duži od dugog na vrhu RP lestvice: 3 × 5000 m se više ne bira (RP ≤ 45 min) |

Nije ugrađeno: **G8** (STOP S2), **HM (c)** (STOP S4), G3 „trkački dan kao trka" u samom planu (urađeno u ispisu
`P8-HM/render.ts`; u planu je trka već poseban dan van obima), talas dugog i ostalo iz „Šta se NE radi u P8".

## Komande (iz `web/`; pre = `git worktree` na `0181e25`)

| | komanda | trajanje |
|---|---|---|
| M1 | `node ../docs/generators-v2/perfection/P8-HM/measure.ts <web koren> <oznaka> [big]` → `P8-HM/out/<oznaka>-{p7,p0,big}.json` | 1,3 s; sa `big` ≈ 3 min |
| M2 | `node ../docs/generators-v2/perfection/P8-HM/render.ts $PWD ../docs/generators-v2/perfection/P8-HM/plans` | 1 s |
| M3 | `node ../docs/generators-v2/perfection/P8-HM/changedP8.ts <pre/web> > src/…/segmentP8.changed-0181e25.json` | ≈ 12 min |
| S | `node scripts/sabotage.mjs ../docs/generators-v2/perfection/P8-HM/sabotage-P8.json --quiet` | 43 s |

Oznake u `out/`: `pre`, pa redom posle svake izmene `g4`, `g5`, `g1`, `g2`, `g7`, `g6`, `hmb`, `posle`.

## Zamerka iz ocene → uzrok → izmena → pre / posle (12 profila P7; M1 `pre-p7.json`, `posle-p7.json`)

| zamerka (P7 / trener) | uzrok | izmena | pre → posle |
|---|---|---|---|
| RP 3 × 5000 m = 88 min kod sporog (p04); p05 15 km RP | plafon samo u km/udelu | G4 | najveći RP trening: p04 88,3 → 35,3 min; p05 55,5 → 37,0; p01 48,3 → 43,5; p12 48,7 → 36,5 |
| T/I predugi u minutima (p04 T 39,7, I 31,3 min) | isto | G4 | p04 T 28,3, I 15,7 min; p09 I 22,1 (isto, VDOT ≥ 40) |
| 75 km za trkača od 2:04 (p04) | vrh 1,4× / +20 bez sati | G1 | p04 vrh 75 → 63,1 km, 8,7 → 7,3 h; p07 75 → 71,5; p06 49 → 44,2; p02 56 → 53,5 |
| plato obima (vrh u ned 5–8) | rast +6 % do plafona | G1 | nedelja prvog vrha: p04 8 → 12, p05 5 → 9, p12 11 → 10, p08 14 → 12 (vrh niži); p01, p09 isto (9) |
| plato dugog | plafon dugog (24 km / 150 min / udeo) veže rano | delimično G1 | nedelja zaredom sa istim dugim: p04 11 → 6, p08 11 → 5, p09 6 → 5; **p05 11 → 11, p01 5 → 5, p03/p10 5 → 5** (talas nije u P8) |
| taper i trkačka nedelja bez trkačkog tempa (p03, p10) | RP 4 km > 15 % cilja tapera | G2 + G5 | taper RP: p03 0 → 24,7 min, p10 0 → 26,2 min; oštrenje p03 0 → 11,1, p10 0 → 11,8 min; **p11 ostaje 0** (taper 19 km ne nosi ni T) |
| oštrenje 19–24 min tri dana pred trku | fiksno 2 × 2000 m | G5 | oštrenje: 14,8–24,3 → 11,0–11,8 min (11 profila) |
| taper 70 min rada (p04) | doze iz km | G4 | p04 taper RP 47,1 → 23,5 min |
| nedelja 23–29 % u trkačkom tempu (p01, p02, p06, p09) | blok + RP trening | HM (b) | najveći udeo vremena u RP: p01 25 → 20 %, p02 23 → 21, p06 24 → 17, p09 23 → 20; nedelja > 25 % brzih km: 6 → 1 |
| test + T + dugi iste nedelje (p01, p05, p09) | test menja samo Q1 | G7 | drugih kvaliteta u nedelji testa: 1 → 0 (p01, p02, p05, p09) |
| test u nedelji najvećeg obima | poslednja nedelja razvoja = vrh | nije (STOP S4) | i dalje u nedelji vrha: p01–p05, p08 |
| lagani 15–19 km uz dugi 20–24 (p04, p08) | lagan ≤ 0,8 × dugi | G6 (4+ dana) | najveći lagan / dugi: p04 79 → 61 %, p01 53 → 51; **p08, p03, p10 (3 dana) ostaju 79–80 %** (zadato) |
| početnik: najduži dugi 11,2 km (p11) | lagani ≥ 4 km + dan kvaliteta, pa udeo | nije (G8, STOP S2) | 11,2 → 10,8 km (niži vrh po G1) — **pogoršanje** |
| tekst sa oznakama i „nije izvodljiv", „odstupanje" | sirove napomene plana | G3 | korisnički tekst: test `segmentP8` (0 reči sastavljanja u uzorku 440 planova); ispis `P8-HM/plans` |

## Metrike mreže P0 (192 ulaza; M1) i velike mreže (27 930; M1 `big`)

| metrika | P0 pre | P0 posle | velika pre | velika posle |
|---|---|---|---|---|
| odbijanja | 0 | 0 | 508 | 484 (novih 0) |
| vrh / start (medijana) | 1,364 | 1,267 | 1,364 | 1,273 |
| sati nedelje na vrhu (medijana / max) | 5,3 / 12,1 | 5,3 / 10,5 | 6,1 / 12,4 | 6,1 / 10,6 |
| nedelja prvog vrha (medijana) | 8 | 9 | 9 | 9 |
| planova sa vrhom pre kraja razvoja | 70 | 14 | 9565 | 1234 |
| nedelja zaredom sa istim dugim (medijana) | 7 | 5 | 6 | 5 |
| najveći RP trening [min] (medijana / max) | 42,8 / 98,3 | 35,3 / 42,8 | 50,6 / 100,5 | 38,0 / 45,0 |
| planova sa RP > 45 min / I > 24 min | 94 / 30 | 0 / 0 | 16 706 / 6056 | 0 / 0 |
| planova sa T > 30 min (cilj < 80 km: 0 posle) | 43 | 24 | 9236 | 3524 |
| planova sa nedeljom > 22 % vremena u RP | 50 | 1 | 6821 | 39 |
| nedelja > 25 % brzih km (zbir) | 83 | 25 | 11 746 | 2676 |
| planova: taper bez RP / trkačka bez oštrenja | 24 / 24 | 6 / 6 | 1425 / 1425 | 246 / 246 |
| oštrenje [min] (medijana / max) | 18,7 / 26,2 | 11,7 / 12,0 | 19,0 / 30,0 | 11,6 / 12,0 |
| planova: test uz drugi kvalitet iste nedelje | 77 | 0 | 13 899 | 0 |
| planova sa testom | 128 | 112 | 21 885 | 20 175 |
| planova sa laganim > 70 % dugog | 71 | 35 (svi 3 dana) | 9787 | 3432 |
| ukupno RP [km] (medijana) | 42 | 34,8 | 47 | 35,4 |
| planova sa taperom > 60 % najveće doze zone | 27 | 88 | 3502 | 11 676 |

Poslednja dva reda su cena: ukupan rad u trkačkom tempu pada (G4, HM (b)), a najmanja doza tapera je češće iznad 60 %
(STOP S1). Preostalih 6 planova P0 bez RP u taperu su početnici 20–25 km / 12 ned (taper ne nosi dan od 8,5 km).

## Odbijanja i uslovi za STOP

- Velika mreža: 508 → 484, **novih 0**, izgubljenih 24. Mreža skorašnjeg dugog 5–12 km u koraku 0,5 (5760 ulaza):
  2343 → 2229, **novih 27** (G6 pomera prag `RECENT_LONG_TOO_SHORT`), izgubljenih 141 — STOP S3.
- G1 identične nedelje / spuštena doza: u uzorku mreža 0 napomena „ponovljen" i 0 upozorenja IDENTICAL_WEEKS.
- G2 nedelje > 30 % brzih km: nezavisne invarijante 0 prekršaja; zbir nedelja > 25 % pada (tabela).
- G6 pad vrha: nijedan plan > 10 % (najviše 8,4 %, 6 dana); niži vrh ima 27 % planova sa 4 dana, 6 % sa 5, 5 % sa 6.
- Nezavisne invarijante (`gridInvariants.checkPlan`) na mrežama 02, 03, početnik i pouka 28 (≈ 36 000 planova): 0.

## Promenjeni planovi (M3; `segmentP8.changed-0181e25.json`, `grid.harness` `CHANGED_P8`)

36 066 ulaza: promenjeno 34 545 — `v` (vrh niži) 22 834, `u` (vrh isti, plan promenjen) 11 636, `n` (odbijanje → plan)
66, `r` (plan → odbijanje) 9 (svi `r-d4/d5/d6-…-40km-v70-r6`, STOP S3). Nije rađena dekompozicija po pravilu kopijama
(kao P5): gotovo svaki plan menja bar G5 (oštrenje) — oslabljena provera baznih linija, kao CHANGED_10/P5.

## Testovi i trajanja

| | komanda | trajanje | ishod |
|---|---|---|---|
| T1 | `npx vitest run --project node src/domain/generators/halfMarathon/v2` (brz, više puta) | ≈ 85 s | poslednji 360/360 |
| T2 | `npm run check` | T2_TIME | T2_RES |
| T3 | `npx vitest run --changed 0181e25` | T3_TIME | T3_RES |
| T4 | `TEST_FULL=1 npx vitest run --project node src/domain/generators/halfMarathon/v2` | T4_TIME | T4_RES |
| T5 | `npx playwright test e2e/hm-v2.spec.ts e2e/handoff-v2.spec.ts --trace off` | T5_TIME | T5_RES |
| S | sabotaže `P8-HM/sabotage-P8.json` (14: G1 × 4, G2, G4 × 2, G5 × 2, G6, G7 × 2, HM (b), G3) | 43 s | 14/14 palo (`sabotage-P8.result.json`) |

Novi test: `segmentP8.node.test.ts` (13 provera, brojevi pravila upisani nezavisno). Usklađeni brojevi (bez slabljenja
osim navedenog): `policy`, `quality`, `volume` (+ G1 testovi), `week`, `dayCap`, `beginner`, `feel` (plan 15 ned umesto
12), `adapt`, `validate`, `segment07/08b/09/10/P1/P5`, `earlyGrid` (27 300 → 27 174 toka), `app/*` (verzije),
`gridInvariants` (nezavisno: plafon u minutima, pod prvog nivoa, vrh G1, lagan 0,7, test G7, oštrenje G5).
Oslabljeno: `adapt` „pouka 30" više ne traži da se skraćenje trkačke nedelje javi u osnovama (pokriva ga sledeći
test); `segment07` N10.1 sada tvrdi da ponavljanja nema (bilo: ponavljanje + upozorenje).

## Šta je ostalo / mišljenje (odvojeno od merenja)

1. Odluke S1–S6 u `P8-HM-STOP.md` (taper ≤ 60 % × najmanja doza; G8; nova odbijanja; test nedelju ranije; kratak plan
   po osećaju bez testa; tumačenja).
2. Plato dugog nije rešen za trkače čiji plafon dugog veže od početka (p05 24 km × 11, p01 22,4 × 5) — to je „talas"
   iz kruga 2. Mišljenje: bez toga ocena progresije za p05/p08 neće bitno porasti.
3. Početnik malog obima (p11) je posle P8 nešto slabiji po dugom (10,8 km) i dalje bez trkačkog tempa u taperu;
   treba mu G8 opcija O2 ili preporuka veće osnove pre plana. Mišljenje: ovo je najslabija tačka HM posle P8.
4. Ukupan RP pada 42 → 34,8 km (P0 medijana): posledica plafona u minutima; specifičnost je sada više u dugom sa
   blokom nego u treningu usred nedelje. Da li je to dovoljno — pitanje za trenera u krugu 2.
5. Ispis za P9 treba da koristi korisnički tekst (`P8-HM/render.ts`), inače ocena jasnoće meri tehničke napomene.
