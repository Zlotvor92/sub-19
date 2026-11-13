# Krug 8 V4 — zahtevi 10K za motor + ostatak HM, 13. 11. 2026

Grana `claude/v4`. V4 skup: **689 prolaze, 19 očekivano pada (`it.fails`), 0 pada**; typecheck i lint čisti;
`npm run check` zelen (4125 + 19). Kapije: **HM 0; 10K 0 na mom poslednjem stanju, 2 posle rebase-a na `cfba8b7` (tab forme)** — p01 n13 skok
46,8 → 53 km, p08 n15 36,9 → 41,5 km; na `cfba8b7~1` sa istim podacima 0 (uzrok u izmeni forme/easyFill, nisam dirao). Mreže obe distance (pun nivo) zelene. `target-compare`
HM 24/72 (isto), 10K 18/54 (bilo 14; 16 pre rebase-a). Stavku 6 (forma) nisam dirao; `vdot.ts` i polja forme u `types.ts` netaknuti.

| # | stanje | test |
|---|---|---|
| 1 | urađeno: čuvar `taper` meri `safety.taper.weekBeforeMaxOfPeak`, poruka nosi broj | `hm/r8` t. 1 |
| 2 | urađeno: u sužavanju/rasterećenju/nedelji trke `dosePct` × min(osnovica, plafon) (10K p05 N−1: intervali 16 → 10 min, RP 21 → 17). Nedelja N−2 je u šablonima „gradnja", pa tamo ostaje × osnovica (10K p05 N−2 21 min) — da se pokrije, N−2 treba označiti u šablonu ili proširiti pravilo | `hm/r8` t. 2 (jedinični) |
| 3 | urađeno: zamena praga (`zoneGapReplacement`) nosi `dosePct` mesta | `hm/r8` t. 3 (pada bez izmene) |
| 4 | urađeno: prvi rad zone posle bola (Z3) sme ispod `minReps` — manji unos istog podražaja, a kad ga nema, deonice se skraćuju (100 m / 15 s, ≥ 50 %); obično smanjenje u rampi (× 0,8) ostaje na najmanjem obliku | 10K `KNOWN` s13, s15, s16 (4 stavke) obrisane, Z3 obe distance |
| 5 | urađeno: izvedena pauza tek kad je praznina duža od najvećeg razmaka rasporeda + 2 dana (`PAUSE_SCHEDULE_SLACK_DAYS`) | `hm/r8` t. 5; 10K `KNOWN` s11 (2) obrisane |
| 7 | **nije prihvaćeno:** skraćenje kvaliteta koji ne staje uz tražene dane (korak 60 s, do 70 % tražene, manji unos) radilo je (HM p06 dva kvaliteta u ned 2 i 4; 10K p02/p06 više kvaliteta), ali obara dva trenerska zahteva 10K: K7 p02 (prvi prag 13 min postaje vrh zone jer su kasniji skraćeni) i udeo dugog p06 (22,6 % < 25 %). Vraćeno; izmena sačuvana u `reports/R8-t7-wip.diff`. Uzrok: `build.ts` grana `roomFor` briše trening; za K7 treba pravilo „skraćen ne ispod prvog iste zone" ili dozvola da prvo mesto zone bude manje | — |
| 8 | urađeno: `safety.raceStartPaceOffsetSec` (HM 5/10); bez podatka motor 5/10. 10K podatak nisam dodao (folder `tenk/` nije moj) | `hm/r8` t. 8 |
| 9 | urađeno: HM `shorter.distanceId: 'tenk'`; test registra: id foldera = id iz `DISTANCE_BY_METERS`, `shorter` postoji i kraći je | `distances/registry.test` |
| 10 | delimično: merilo sužavanja nije vršna nedelja skraćena zbog događaja (prozor + 28 dana) → 10K s27 (nastao posle t. 2) bez repa do 27. 2. **Otvoreno:** 10K s26 (bol → trka) rep 4 ned + 6 dana — skraćenje na 28 dana vraća dugi 50 → 76 min (+26 min > R2) | Z10 obe distance; `KNOWN` s26 ostaje |
| 11 | delimično: izlazak iz početne rampe (plan posle testa/trke) po R2 — P2 B dugi 35 → 55 → 70 min (bilo 35 → 65). **Otvoreno:** P1 A lagani ≥ 7 km — dva kvaliteta + dugi pojedu nedelju; pod iz istorije bi digao nedelju iznad cilja | `hm/r8` t. 11 (pada bez izmene) |
| 12 | delimično: 10K kapija bez izuzetka „lagan na najkraćem trajanju", mreža bez izuzetka za `taper` (t. 2). Ostaje izuzetak `lagan-kratak` (p06 vrh 8 % < 10 %) dok t. 7 nije rešen | 10K kapija, `tenk.test` mreža |

## Otisci i ispisi
- HM promenjeni svi 12 (t. 2: manje doze u rasterećenju/sužavanju; i podatak HM `recovery.loadFactor` 0,76 → 0,74,
  jer bi p07 n6 posle manje doze pao ispod cilja — lagani su ograničeni na 65 % dugog). v1/v2 vlasnika nepromenjeni.
- 10K promenjeni p01, p04, p05, p07–p10 (t. 2), p05 i t. 3. Scenariji i parovi obe distance osveženi.

## Nova opšta pravila motora
1. Udeo sužavanja čuvara = podatak. 2. % doze u lakoj nedelji od manjeg (osnovica, plafon). 3. Zamena nosi % mesta.
4. Posle bola prvi rad zone sme ispod najmanjeg oblika (manji unos / kraće deonice). 5. Pauza iz praznine prema
rasporedu trkača. 6. Start trke = podatak. 7. Sužavanje se ne meri skraćenim vrhom. 8. Izlazak iz početne rampe po R2.
Nova polja distance: `safety.raceStartPaceOffsetSec`; konstante `PAUSE_SCHEDULE_SLACK_DAYS`, `REP_SHORTEN_MIN_SHARE`.
