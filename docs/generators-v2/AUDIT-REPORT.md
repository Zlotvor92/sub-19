# Dubinska provera v2 generatora — izveštaj organizatora (23. 10. 2026)

Kod: `670700e` (main posle PR #48). Plan: `AUDIT-PLAN.md`. 7 uglova, svaki u svojoj sesiji, samo čitanje + merne skripte
(`docs/generators-v2/audit/<ugao>/`, zadaci `audit/briefs/`). Svaki B nalaz organizator je ponovio sam pre odluke
(skripte u `audit/organizer/` i ponovljeni izlazi uglova; brojevi isti).

## Šta je mereno

| ugao | obim |
|---|---|
| 1a trener 5K/10K | 46 pročitanih planova (uklj. profil korisnika 20:25 → < 20:00), 3 816 + 10 374 planova mreža, 13 070 tokova |
| 1b trener HM/MAR | 12 + 6 + 8 novih profila po distanci; 56 502 planova, 87 984 toka, 34 776 tokova skoka dugog |
| 2 nasumični ulazi | 4 × 100 000 dozvoljenih ulaza (seed 20261023): 340 984 planova |
| 3 lanci | 4 × 20 000 lanaca od 2–6 adaptacija (308 765 koraka) + 2 314 lanaca posle predaje |
| 4 jedan vlasnik | čitanje koda sve 4 + ~1,2 mil. poređenja formula/tokova; uslov 7 AST |
| 5 doslednost | pouke 1–38 × 4 distance; 233 000 tokova merenja odloženih odluka; 34 situacije poruka |
| 6 aplikacija | 21 istraživački E2E tok (sve 4 distance, predaja, prekidač, telefon) |

Svuda 0: izuzetak (throw), nedeterminizam, prazan trening, nedelja ispod minimuma u generatoru, dugi < lagan u
generatoru, nedostaje policyId/faza, prošlost/urađeno/zaključano promenjeno, uvoz van foldera distance.

## Blokirajući nalazi (B) — ponovljeni, idu u ispravku

| # | distanca | nalaz | broj | izvor | ispravka |
|---|---|---|---|---|---|
| B1 | sve 4 | ista adaptacija dvaput (manjak izvršenja) seče plan ponovo za 20 % (18,7 → 15 → 12 km) | 16–23 % lanaca | chains C2 | Z7 |
| B2 | sve 4 | dan zaključan u ranijem koraku + bol → sledeća adaptacija odbijena (LIMITS) | ~900–1 200 / 20 000 lanaca | chains C1 | Z6 |
| B3 | sve 4 | bol „sutra bez novih zapisa" → osnova iz već smanjenog cilja, kaskada do tapera | 16–245 lanaca | chains C6 | Z8 |
| B4 | HM, MAR | skok dugog posle netrčanih nedelja (19 dana bez trčanja + bol: dugi 8,5 → 21,4 km) | HM 1 060 / 9 058, MAR 3 584 / 25 718 | 1b #5 | pravilo pokrivenosti za L |
| B5 | HM | bol 8 + umor u istom koraku → WEEK_INFEASIBLE | 19 490 / 19 490 scenarija | owner | jedan „poslednji dugi" |
| B6 | HM | recentLongRunKm + bol → umor → umor → DELOAD_LONG | 3 758 / 13 860 | owner | jedna referenca dugog rasterećenja |
| B7 | MAR | bol 8 kraj N−2 → prazna trkačka nedelja (EMPTY_WEEK) | 224 / 10 976 | owner | jedna „trkačka samo sa trkom" |
| B8 | MAR (HM, 10K) | po osećaju + zaključan test + nov rezultat → TEST odbijanje | 40 / 192 odbijenih | chains C3 | zaštićen test = činjenica |
| B9 | 10K (+ izmeriti 5K/HM/MAR) | vraćanje revizije: vraćen plan krši validator, sledeća adaptacija odbijena | 1 207 i 172 / 2 880 | owner O-3 | Z4 |
| B10 | 5K | 3 dana, dan trke: 12/245 kombinacija (npr. uto/pet/ned + trka ned) → WEEK_INFEASIBLE bez preporuke | 1 604 realnih / 100 000 | fuzz F1 | oštrenje i na lagan dan |
| B11 | 5K | 3 d / 12 km odbijeno za svaki VDOT | 273 / 1 023 | fuzz F2 | manja doza / 1 kvalitet |
| B12 | 5K | zaključan dan kvaliteta u nedeljnim pravilima doze/testa; bol 8 u taperu → RACE_WEEK_TAPER | 83 + 95 + 40 lanaca | chains C4, C5 | zaštićen dan = činjenica; pouka 30 |
| B13 | 5K, 10K kao cilj predaje | rezultat HM/maratona iz izvora → odbijanje cilja | 6/6 ulaza | consistency C7 | Z5a |
| B14 | HM, 10K kao cilj predaje | maraton početnik 45 km → nijedna ponuda kraće distance | E2E | app A1 | Z5b |
| B15 | HM | početnik u 3 koraka → WEEK_INFEASIBLE taper; bol 9 + umor + manjak → WEEK_INFEASIBLE | 6 + 8; 1 | owner, chains C10 | potvrditi uzrok, pouka 14 |

## Trenerski i kozmetički nalazi koji idu u isti krug (jeftini, odlučeni)

5K: napomena „planirano X km" ≠ planirano (1 114 / 5 170), „Rasterećenje:" van rasterećenja (2 221 / 5 170), početnik
rasterećenje u ned 2 (72 / 648, pouka 4), rezultat VDOT < 30 → po osećaju (kao 10K), umor bez dayId = lagan, jedna
„poslednja izgradnja", početnik bez kontrolnog trčanja (pouka 13), test granice plafona trajanja.
10K: oštrenje u trkačkoj sa WU/CD izgradnje (65 % trkačkih nedelja), test u D25, preporuka dana = ista funkcija kao ulaz,
relativni broj nedelje uvoda.
HM: pouka 35 i u taperu, napomena „ne sme biti duži" kad jeste, uvod bez broja koji liči na kalendarsku nedelju.
MAR: plafon 150 min istim tempom (pogrešan razlog MARATHON_LONG_SHORT 1 409 / 17 300).
Sve 4: pouka 37 dopuna (kvalitet ostaje uz upisani višak ≤ 10 %), bez internih oznaka u tekstu korisnika (79 / 79 napomena
HM/MAR), decimalni zarez, Forma ne piše „čeka prilagođavanje" za ignorisan rezultat, upozorenje MIXED i kad je vlasnik
pauza. Zajednički UI: dupla tačka u „Fokus nedelje" — ispravljeno (d2f812a).

## Odluke organizatora o odloženim pitanjima

- Drugo rasterećenje istog cilja posle umora u rasterećenju: prihvaćeno (MASTER pouka 36 dopuna).
- Prag viška za otpadanje kvaliteta: kvalitet ostaje kad je višak samo upisan i ≤ 10 % (MASTER pouka 37 dopuna; mišljenje,
  bez izvora).
- Pravilo pokrivenosti važi i za osnovu skoka dugog (MASTER pouka 37 dopuna).
- Maraton → 5K u aplikaciji ne postoji po dizajnu (FINAL ispravljen).
- Odloženo sa razlogom: `final-check/POSLE-MERGE.md` § „Dubinska provera" (lagan prema dugom, taper MP, usklađivanje
  pravila C3–C14, plauzibilnost ulaza, 5K 4 dana, pauza 35, mišljenja o profilu).

## Plan ispravki

Spisak po distanci (zaključan): `audit/fixes/00-common.md`, `5K.md`, `10K.md`, `HM.md`, `MAR.md`,
`01-chains-addendum.md`. Segmenti 5K-09, 10K-07, HM-09, MAR-09 rade paralelno na radnoj grani, svaki u svom folderu.
Posle: organizator nezavisno ponavlja merne skripte uglova na vrhu grane + `run-all.sh` (sve 4) + CI. U main samo na
izričitu odluku korisnika.
