# R19 — motor (isti tab kao R18), 14. 11. 2026 (po Beogradu) — ZAUSTAVLJENO: kontekst taba je potrošen

Stanje je nepromenjeno od R18 (`459c41f` plus brief `f08e62ce`): kapije 4 × 0, 1038 testova prolazi, 25 očekivano
pada. U R19 nijedna stavka nije završena i nijedan push koda nije urađen. Nedovršen rad na stavci 1 je sačuvan kao
`reports/R19-t1-wip.diff` (123 reda) i vraćen iz radnog stabla.

## Stavka 1 (povratak posle pauze): šta je probano (WIP diff)
- `pauseRampDays` po dužini pauze: ≤ 4 dana 0, 5–10 dana 10, 11–21 dan 21, duže po starom pravilu. Blaga dnevna rampa
  (`start` 0,85) za pauze do 21 dana.
- `smoothExit(…, ret)`:
  - referentna nedelja = najveća od poslednje 4 pre pauze; referentni dugi = poslednji pre nje;
  - nedelje povratka po rasporedu: 75/90 % za 5–10 dana, 60/75/90 % za 11–21 dan, nikad iznad plana;
  - prvi dugi ≤ ¾ referentnog, drugi = referentni;
  - posle toga R2 važi samo iznad referentne.
- Ishod: MAR s07 sada ima 31 | 29 | 37 | 41 km, a plan bez događaja 38 | 35 | 41 | 41.
  - Druga i treća nedelja ostaju ispod rasporeda. `smoothExit` samo skraćuje, a nedelje spušta gradnja u `build`:
    plafon dugog u rampi (`RAMP_LONG_SHARE` × `lastLongSec` dok je g < `QUALITY_FROM_F`) i lanac rasta posle
    rampe (`rampSeen`).
  - Raspored zato mora da bude u `build`: cilj nedelje u rampi = udeo referentne, ne dnevni f.
- Pada 13 testova:
  - koje odluka organizatora svesno menja: examples § 14.6 (rampa po razlogu: 7/11/14 dana), hm/r14 s5/s6/s27
    (60–70 % / ≤ 85 %), četiri kopije R2 testa u `distances/*/scenarios.test.ts` (merilo treba da bude
    max(prethodna, referentna));
  - koje treba proveriti kao moguću regresiju: Z2 (HM, 10K), MAR returnKeepLong, round6 (c), hm/r14 s05.

## Ostalo (stavke 2–7)
Nisu započete. Stavke su date u briefu R19, a nalazi za 2d, 3 i 5 stoje u R18-REPORT § „Nije urađeno".
Predlog za sledeći tab: stavku 1 početi od ovog diff-a i premestiti raspored u `build`.
