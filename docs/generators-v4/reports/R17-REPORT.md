# R17 — motor, nastavak posle R16 (13. 11. 2026) — DELIMIČNO, pun kontekst

Stanje `65fcf01`. Kapije HM, 10K, 5K i MAR su na 0. V4: 60 fajlova, 1005 testova prolazi, a 23 očekivano padaju.
Lint i typecheck su čisti, a ispisi sve četiri distance odgovaraju kodu.

## Urađeno
- `faca228`: stavka 7 (deo) i M23.
  - Po odluci organizatora nedelja trke i −1 smeju da izostave lagan dan na podu. Pre toga silazak skrati dugi,
    a prostor oslobođen izostavljenim danom vraća se dugom.
  - Podatak HM: −1 ≤ 70 % vrha i nedelja trke ≤ 45 % vrha. HM p06: −1 34,1 → 30,1 km, nedelja trke 25,6 → 19,6 km.
  - `taperShape` (A10a) sada dozvoljava manje dana u −1. To je namerno menjan test za HM, 10K i MAR.
  - M23: kad pravilo godina skine brz trening, dan pred dugi dobija ubrzanja (5K p16).
  - Otisci: HM p02, p06; 5K p06, p16; 10K p06; MAR p06.
- `8f22e85` (hitno): M4 broji samo TEŠKE dane zaredom; lagan dan prekida niz (`days: 1`). HM p04/p12 i MAR
  p04/p12/p15 su bajt-isti stanju pre `854cc56`. HM p04 opet ima tempo trke 3 × 15 min, bez pogrešnog upozorenja.
  Test čuva tempo trke utorkom.
- `65fcf01` (stabilnost): ispis je računao očekivano vreme dana trke iz današnjeg stanja i uz istu formu; 10K s22
  je imao 54:23 → 54:41 uz PROMENA 0.
  - Uz formu istu kao u planu (< 0,3 %) ispis sada uzima vreme iz plana. Menjaju se samo scenariji „ništa".
  - Test: „ništa" sa promenom 0 ima isti red očekivanog vremena pre i posle (HM, 5K).

## Nije urađeno (redom iz poruka organizatora)
- M22 („vršna" = najveća): probano dva puta. Merilo motora (stvarni km prošlih nedelja) i čuvara (plan) se
  razilaze posle događaja, pa nastaju novi nalazi `silazak` u scenarijima. Treba jedno merilo u oba.
- p08 ned 1 (upozorenje „3 dana ne nose 45 km" sa predlogom 4. dana), p08/p10 ned 15, p12 N−2.
- Smer tempa (5K S02/S03/S18/S19/S26, S01 dan trke): test nad svim distancama.
- Prenos sa polumaratona (10K s03).
- M5 (provera posle događaja ne zamenjuje glavni tempo trke).
- Tekstovi izmena (5K S08/S11/S12/S26).
- 5K p06 (trimOrder, ned 5, nedelja trke 70 %), 10K s13, 5K s26 (M19), MAR s28 (M11).
- Stavka 8 i M27.
- „Ništa = bajt-isti" za 10K/MAR treba dodati u njihove foldere (isti test kao `hm/r15`).
