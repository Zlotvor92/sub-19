# Dopuna spiska ispravki — ugao 3 (lanci), organizator 23. 10.

Izvor: `docs/generators-v2/audit/chains/REPORT.md`. Organizator je ponovio: C1 (`rej.ts 5K 20261023 84` → LIMITS
„Kvalitet na dan zabrane kvaliteta" za dan zaključan u ranijem koraku) i C2 (`dbg.ts 5K 20261023 106 0`: iste činjenice,
isti asOf, ponovna adaptacija → cilj ned 5 18,7 → 15 → 12). Alati: `chains.ts`, `rej.ts`, `dbg.ts`, `idemp.ts`
(seed 20261023; najkraći lanci u REPORT.md).

Zajedničko (sve 4 distance) — obavezno, B:
- Z6 (C1): provera LIMITS (5K `validate.ts:1016`, 10K `:1725`, HM `:1871`, MAR `:1830`) preskače SAMO dane zaključane u
  tekućem koraku. Ispravka: ista funkcija „zaštićen dan" (≤ asOf, zaključan u bilo kom koraku — svi
  `adaptation.lockedDayIds`/snimak izmena —, urađen) u LIMITS i ostalim proverama po danu; validator ne sudi činjenicama.
  Cilj: odbijeni realni lanci LIMITS → 0 (`chains.ts` / klasifikacija `classify-rej.ts`).
- Z7 (C2): manjak izvršenja nije idempotentan — `tn` = cilj TEKUĆEG (već smanjenog) plana (5K `assess.ts:445–452`,
  10K `:475`, HM `:467`, MAR `:475`). Ispravka: manjak vezan za zapise kao umor (pouka 36) — korak koji već pokriva isti
  prozor zapisa ne pravi novi, referenca = cilj iz plana pre koraka manjka. Cilj: `idemp.ts` same → 0 promena za manjak.
- Z8 (C6): bol — „sutra bez novih zapisa" sidro prelazi nedelju i osnova povratka = već smanjen cilj (5K
  `volume.ts:227` returnBaseKm) → kaskada. Ispravka: isti zapis bola ne pravi nov korak; osnova iz plana pre koraka bola.
  Cilj: `idemp.ts` next (pad > 10 % bez novih zapisa) → 0 za bol i manjak.

Po distanci:
- MAR (+ HM, 10K proveri): C3 — plan po osećaju + zaključan dan testa + nov rezultat → TEST A13/M17. Zaštićen test ostaje
  kao činjenica (pouka 38) i ne broji se kao „test plana po osećaju". Cilj: MAR `i=18` prolazi; odbijanja TEST → 0.
- 5K: C4 — QUALITY_REPEAT/TEST_WEEK/DOSE_PROGRESSION/BASE_R_DECREASE sa zaključanim/ranije zaključanim danom
  (`i=45`, `i=288`, `i=9115`, `i=6392`): nedeljna pravila doze/testa čitaju zaštićen dan kao činjenicu (kao Z6).
  C5 — bol 8 u taperu → RACE_WEEK_TAPER odbijanje (`i=2650`): trkačka po pouci 30 (skraćenje/upozorenje), ne odbijanje.
- HM: C7 — taper posle bola + umor 2 nedelje pred trku: svi dani 4,0 km, dugi 4 km (`i=4878`) — potvrdi; ako je
  degenerisan, ispravi. C10 — WEEK_INFEASIBLE `i=1888` (manjak + umor + bol 9): upozorenje po pouci 14, ne generičko
  odbijanje. C9 (K) — `adaptInvariants.ts:326` izuzima zaključan/urađen dugi.
- 10K: C7 — zaključan lagan dan trkačke drži trkačku > taper (`i=5771`): upozorenje umesto tišine.
- 5K, 10K, MAR: C8 (T, jeftino) — mešovita nedelja planirano > cilj bez upozorenja kad je vlasnik pravilo pauze
  (`pauseRemainder`): dodaj upozorenje MIXED.

Na kraju (pored run-all): `chains.ts <D>` na 2 000 lanaca istog seed-a → odbijanja realnih lanaca pre/posle, `idemp.ts`
pre/posle (same i next).
