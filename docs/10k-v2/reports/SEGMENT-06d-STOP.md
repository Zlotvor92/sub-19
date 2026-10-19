# 10K v2 — Segment 06d (10k-v2.5.1): STANI posle koraka 1 (nove klase odbijanja + K2 kako je zadat ruši konstruktorov validator)

Polazni SHA `51a924f`. Grana `claude/generator-isolation-5k-10k-hm-marathon`. **Kod generatora nije menjan** (commit
sadrži samo `docs/10k-v2/`). Prototip ispravke K1/K2 je sačuvan kao `artifacts/segment-06d/k1k2-prototype.diff` (primenjiv
na `51a924f`, `git apply`), NE kao commit.

## 1. Zaključak

1. N7 pretraga organizatora je tačno ponovljena: 61 104 toka, odbijeno 152 = **142 K1 + 10 K2** (isto kao b70931f).
2. Šira mreža iz koraka 1 (847 392 toka) ima **4 nove klase odbijanja** (3007 tokova) koje nisu K1/K2 → odluka 3: STANI.
3. K2 po odluci 2 (konstruktor računa najduži dugi iz UPISANIH dana) u prototipu **uvodi 668 novih odbijanja i menja 11
   prihvaćenih tokova**: validator se poziva dva puta — u `construct` nad SASTAVLJENIM planom i u `adaptTenKV2` nad
   UPISANIM (spojenim) planom. Jedna definicija na upisanim danima zahteva odluku koja provera vidi koji plan → STANI.
4. K1 po odluci 1 radi: u prototipu 0 K1 u obe mreže (314 tokova ispravljeno); od 11 promenjenih prihvaćenih tokova
   nijedan nije od K1 (provereno: prototip bez K2 dela daje bajt-iste heševe za svih 11). Puno merenje „samo K1" nije
   rađeno.

## 2. Merenje pre (`51a924f`; `artifacts/segment-06d/measure-before-51a924f.json`)

Skripta `measure-06d.ts` (node, 4 procesa, 1534 s zida). Mreža S: gridInputs svaki 12. (252), feel svaki 7. (1698),
beginner svaki 3. (1134) = 3084 plana × asOf sreda i kraj svake nedelje 1 … N − 2 × 12 scenarija (pauza 10/20/35, bol
5/8, pauza 10 + bol 5, manjak, višak 120 %, umor, test5k, brži, sporiji). Klasifikacija: K1 = VOLUME_RULE „bez oznake"
u nedelji koja je u osnovnom planu rasterećenje sa testom; K2 = TAPER_LONG.

| mreža | tokova | odbijeno | K1 | K2 | RACE_WEEK_OVER_TAPER | ROLES | DELOAD_CONTENT | TAPER_QUALITY |
|---|---|---|---|---|---|---|---|---|
| N7 | 61 104 | 152 | 142 | 10 | 0 | 0 | 0 | 0 |
| S | 847 392 | 3197 | 172 | 18 | **1308** | **1692** | **6** | **1** |

Po scenariju (S): K1 pain5 54, pain8 51, pause10pain5 31, pause20 36; K2 pain5 9, pain8 9; RACE_WEEK_OVER_TAPER samo
pain8; ROLES samo umor; DELOAD_CONTENT pauza 10 (2), pauza 20 (2), manjak (2); TAPER_QUALITY pauza 20 (1). Ostali
scenariji (pauza 35, višak, test5k, brži, sporiji): 0.

## 3. Nove klase — broj, primer, uzrok (nije ispravljano)

### N-a. RACE_WEEK_OVER_TAPER — 1308 (bol 8, asOf kraj nedelje N − 2)

Primer `10w-25km-v30-A-sat`, bol 8 na dan 2026-12-26 (kraj ned 8): korak daje odmor 12-27…12-29 i bol 12-30…01-05.
Taper (ned 9, cilj 26,3) ima 2 dana odmora → ostaju 2 lagana po 4,1 km = **8,2 km**; trkačka nedelja (ned 10) ima 3 dana
trčanja pored trke: dva dana bola (lagan ≥ 3 km, A4) + 4,1 km (= najkraći lagan tapera, D23) = **10,1 km > 8,2**.
Oštrenje već otpada (A9). Uzrok: D23 (trkačka ≤ taper) ne može da se ispuni kad dani odmora skrate taper ispod zbira
minimalnih laganih trkačke nedelje (D20 broj dana, A4 lagan ≥ 3 km); konstruktor nema pravilo za to, validator odbija u
`construct`. Pogođeno: sve porodice (R, F, B), asOf tačno kraj ned N − 2.

### N-b. ROLES — 1692 (umor, početnik, asOf nedelja 1)

Primer `b-d3-10w-20km-e390-A-sat`, umor (2 × RPE 8), asOf 2026-11-07 (kraj ned 1): A5 prinudno rasterećenje ned 2.
Ned 2 je kod početnika uvod (D28: nedelje 1–2 bez kvaliteta, dan kvaliteta lagan), a rasterećenje se gradi sa jednim
kvalitetom T 1,5 km (`q1@thu`) → `ROLES: Dani easy@tue, long@sun, q1@thu ≠ šablon easy@thu, easy@tue, long@sun (D9)`.
Uzrok: prinudno rasterećenje (A5) u uvodnoj nedelji početnika ne poštuje „uvod bez kvaliteta" (D28); validator
(šablon uvoda) ga odbija. 1692 od 2268 tokova „početnik × umor × asOf ned 1".

### N-c. DELOAD_CONTENT — 6 i N-d. TAPER_QUALITY — 1 (početnik 3 dana, B/ned, 16–18 ned, asOf sreda ned 10–11)

Primer DELOAD_CONTENT `b-d3-17w-30km-e330-B-sun`, pauza 10, asOf 2027-01-06 (sreda ned 10, ujedno dan Q1): upisan Q1 ned
10 je zaštićen (≤ asOf) i ostaje **T 3600 m**; konstruktor je ned 10 sastavio sa **T 3000 m** („T spušten sa 3,6 na 3,0")
i stanje doze vodi iz sastavljene nedelje → rasterećenje ned 13 T 1500 m; validator (D31: 60 % poslednje T doze iz
UPISANOG plana, 3600 m) traži T 2000 m. TAPER_QUALITY `b-d3-16w-30km-e330-B-sun`, pauza 20, asOf 2027-01-13: isto —
upisan Q1 ned 11 je RP 3600 (zaštićen), sastavljen T 2000; validator iz upisanog: poslednja T doza 3600 → T tapera 2000 >
plafon 1940 → očekuje taper bez kvaliteta; konstruktor (poslednja T 2000) daje T 1500.
Uzrok: **ista porodica kao K2, ali za stanje doze kvaliteta (D5/D7/D31), ne za dugi** — konstruktor vodi stanje iz
sastavljene nedelje, validator posle spajanja iz upisane (zaštićen prošli dan kvaliteta).

## 4. Prototip K1/K2 (`k1k2-prototype.diff`, merenje `measure-prototype.json`, poređenje `compare-before-prototype.json`)

- K1 (`generate.ts`): pretraga kao do sada; za rasterećenje sa testom cilj iznad pravila samo ako sastavljena nedelja
  ima test; ako ni jedan cilj nije izvodljiv — faza (b): okvir bez testa, obično rasterećenje samo naniže. Primeri:
  `f-d4-12w-25km-e270-A-sun` bol 5 2026-11-05 → ned 4 17 km bez testa (bilo 20); `f-d5-12w-30km-e270-C-sat` pauza 20
  2026-11-07 → ned 4 18,5 km.
- K2: `lengths.longestLong10(weeks)` (jedna funkcija; validator je čita), `written.ts writtenDays` (spajanje A11 iz
  `adapt.ts` izdvojeno), `construct(raw, steps, prior)` računa najduži dugi iz upisanih dana. Primer
  `f-d5-8w-35km-e270-A-sat` bol 5 2026-11-04: upisan dugi ned 1 = 9,2 km (zaštićen, 11-01), sastavljen bio 10,5 →
  dugi tapera 6,9 km (bilo 7,3), prihvaćeno.

| | pre | prototip |
|---|---|---|
| N7 odbijeno | 152 (K1 142, K2 10) | **27 (K2 27)** |
| S odbijeno | 3197 | 3648 (K1 0, **K2 641**, nove klase N-a…N-d nepromenjene: 3007) |
| prihvaćen pre → promenjen | — | **11** (svi pauza 10 + bol 5, asOf sreda ned N − 2; uzrok K2 deo) |
| prihvaćen pre → odbijen | — | **668** (svi TAPER_LONG) |
| odbijen pre → prihvaćen | — | 342 (K1 314, K2 28) |

Uzrok 668: `construct` validira SASTAVLJEN plan (dani pre asOf su sastavljeni, ne upisani). Kad je upisan dugi
prošle nedelje duži od sastavljenog (npr. pauza smanji nedelju 1, a upisan dugi 11-01 je stari), konstruktor po upisanom
najdužem dozvoli duži dugi tapera, a validator u `construct` (najduži iz sastavljenih) ga odbije. Primer
`f-d3-8w-20km-e270-A-sat`, pauza 20 do 2026-11-04: `TAPER_LONG: Dugi tapera 6.3 km > 0,75 × najduži 8.3 km` (iz
`construct`). Na 51a924f isti tok prolazi jer obe strane vide sastavljeno; K2 (10 + 18) je obrnut slučaj (upisan kraći od
sastavljenog → validator posle spajanja odbija).

## 5. Otvorena pitanja (odluka organizatora)

1. **K2 / N-c / N-d (ista porodica)**: koji plan vidi „jedna definicija"? Predlog (A): konstruktor vodi SVE stanje koje
   validator čita iz plana (najduži dugi D7, stanje doze D5/D7/D31, poslednji dugi D5) iz upisanih dana, a validator u
   `construct` dobija upisani plan (isti `prior`, spajanje `written.ts`) — tada se obe provere poklapaju; ili (B)
   validator u `construct` preskače proveru zavisnu od prošlosti, a završna u `adapt` ostaje. (A) menja i 11 (ili više)
   prihvaćenih tokova (dugi tapera po upisanom najdužem) — da li je to dozvoljeno, ili zahtev „prihvaćen tok bajt-isti"
   važi i tada?
2. **N-a (1308)**: trkačka > taper kad dani odmora skrate taper — pravilo (npr. lagan trkačke nedelje ≤ najkraći lagan
   tapera i kad je dan bola, ili D23 izuzetak uz napomenu kad taper ima dane odmora)?
3. **N-b (1692)**: prinudno rasterećenje (A5) u uvodnoj nedelji početnika — bez kvaliteta (kao uvod), ili A5 ne pada u
   uvod (pomera se/otpada)?
4. K1 se može primeniti odvojeno (deo `generate.ts` iz prototipa; trajna mreža E iz prototipa bi tada imala izuzetke za
   K2/N-a…N-d) — ili čekati jedinstvenu odluku?

## 6. Komande

- `node ../docs/10k-v2/artifacts/segment-06d/repro-n7.ts` (iz `web/`, 51a924f): 61 104 / VOLUME_RULE 142 / TAPER_LONG
  10, 392 s.
- `node ../docs/10k-v2/artifacts/segment-06d/measure-06d.ts <izlaz> <worktree 51a924f>`: 1534 s; isto nad prototipom:
  1485 s; `compare-06d.ts <pre> <posle> <izlaz>`.
- Prototip: `npx tsc -b --noEmit` exit 0; testovi NISU pokretani (STANI pre koraka 2).

## 7. Stalni uslovi (AGENTS.md 1–8)

Kod nije menjan — uslovi 1–8 važe kao na `51a924f`. Prototip: 1 (K1 jedno mesto `generate.ts`, dve faze bez petlje;
validator nepromenjen osim čitanja `longestLong10`), 7 (novi `written.ts` u `tenK/v2/`, bez uvoza van foldera), 8
(trajna mreža E u prototipu, nepokrenuta). Uslov 1 je upravo ono što N-c/N-d i K2 krše: stanje „prošlosti" ima dva
vlasnika (sastavljena i upisana nedelja).
