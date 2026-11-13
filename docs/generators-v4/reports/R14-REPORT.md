# R14 — krug 14 (motor), 13. 11. 2026 — DELIMIČNO (stavka 1 i deo stavke 2)

Stanje `555f70f` + izveštaj. Kapije HM, 10K, 5K, MAR: 0. V4: 58 fajlova, 986 testova prolazi + 25 očekivano pada.
Lint i typecheck su čisti. Ispisi sve četiri distance su osveženi.

## 1. M7 + M17 (urađeno)
- M7: kad postoji upozorenje „mali-obim" ili „kratak-dugi", a vrh ili dugi je ispod 90 % adekvatnog
  (`NO_PROGRESS_SHARE`), plan ne računa napredak od obima. Uz „dugi-za-distancu" to je važilo i ranije.
  Prognoza i tempo trke tada su jednaki današnjoj formi, a rečenica kaže zašto.
  MAR p03, p06, p10, p11, p19 i p01 više nemaju „N brže od današnje". p13 je već bio bez napretka.
  Blizu praga napredak ostaje: vlasnik-v1 (dugi 15 od 16 km), MAR p04/p15 (26,2 od 28 km) i HM s19.
- M17: rezultat bolji od dosadašnje procene, a slabiji od verovanog, zadržava pripisani napredak do nivoa koji je
  pokazao (`fitness/estimate.ts`). 5K s03: 1570 → 1551 s, pa je KNOWN obrisan. Promene: 10K s03 (53:38 → 53:07),
  HM s11 (−1 s).
- Namerno menjani testovi: SPEC § 12 (a) (dugi 14 od 18 km → očekivano 1:41:00); K1 sintetika i maraton (izuzetak
  `raceDayNoProgress`, uz rečenicu); R10 (forma se pomera sa prognozom); kapija MAR „ništa": p06, p19 prolaze,
  p10 u FORM_DRIFT (+6 s pomak današnje forme). U maratonskom folderu samo te dve linije, jer ih traži motor.

## 2. M2 ostatak (deo)
- Rampa posle pauze kreće od 0,5 (`PAUSE_RAMP_START`), bez dana odmora; brz rad i plafon dugog na istom delu rampe.
  Povratna/druga nedelja (% poslednje odrađene): HM s05 45/56 → 67/58 (druga je rasterećenje); HM s06 41/55 → 68/68,
  ned 17 ostaje 53,1 km; HM s27 64/76 → 69/83, vrh 62,7 km zadržan; 10K s05 45/55 → 64/77; MAR s05 41/57 → 67/76;
  MAR s06 38/43 → 60/68.
- Rast dugog posle prekida je najviše +20 min, bez „ili +25 %" (`smoothExit`, `capTail`).
- U povratku je lagan dan bar 30 min uz dugi ≥ 90 min, odnosno 45 min kod 5+ dana i obima ≥ 55 km. Pravilo važi
  za nedelje koje skraćuje `smoothExit`.
- Lagani dani se skraćuju po 5 min pre nego što kvalitet padne na najmanju dozu. Ranije je zaokruživanje bacalo
  prag 2 × 18 na 2 × 5.
- Pauza završena ≥ 7 dana pre plana (`baseAfter`): sadašnji obim se ne skraćuje ponovo, a plafon dugog je sadašnji
  dugi. 5K p15 ned 1 13,1 → 17 km, ned 2 13,9 → 19,1. Ostatak ograničava polazni dugi od 40 min. Menjaju se otisci
  5K p15 i MAR p15.
- Test `hm/r14`: povratna nedelja 60–72 %, druga ≤ 85 %, dugi +20 min, s06 ned 17 ≥ 52 km.

## Nije stiglo (redom)
- 2 ostatak:
  - lagan ≥ 30/45 min u nedeljama rampe i bola (MAR s05 n7, s13, s16, s25; HM s14) i u prvobitnim nedeljama
    (HM s05 n12 24 min);
  - MAR: dugi ≥ 26 km kad je do trke ≥ 4 nedelje (s06 najviše 2 h 07) i referenca „poslednji pravi dugi" posle puta.
- Stavke 3–8 iz briefa: M20/M12, M6/M24, M10, M3/M4/M23/M26, podatak HM, M5…M27.
