# Maraton v2 — ispravke posle provere (segment MAR-09). Folder web/src/domain/generators/marathon/v2/

Obavezno (B):
1. owner: bol 8 kraj ned N−2 (3 d) → EMPTY_WEEK trkačke (224/10 976). Uzrok: `week.raceWeekRest` (`week.ts:893–925`)
   vs `raceOnlyWeek` (`week.ts:827–838`) → jedna definicija „trkačka samo sa trkom"; trkačka nedelja = trka (+ odmor/
   lagano po pravilu) uz upozorenje, nikad prazna. Cilj `audit/owner/mar-emptyweek-search.ts` → 0,
   `mar-emptyweek-example.ts` → plan.
2. 1b #5 skok dugog: plafon skoka (`lengths.ts:38` jumpBase10) uzima L iz planiranih dugih i za nedelje za koje pokrivenost
   kaže da nisu trčane (MAR 5 d 70 km painPause: ned 14 dugi 10,9 → ned 15 26,9). Pravilo pokrivenosti pouke 37 važi i za
   L; nedelje 1–4 ostaju. Cilj `audit/coach-hm-mar/measure-jump.ts MAR 400 200 100` iznad plafona iz trčanog → 0.
3. Z4 vraćanje revizije (izmeri; ispravi ako krši).

Jeftino (T/K, odlučeno):
4. owner: MARATHON_LONG_SHORT pogrešan razlog (1 409/17 300) i poruka kapaciteta (247/2 463): plafon 150 min istim tempom
   (tempo nedelje `pacesAt`) u konstruktoru, `longShortOf` i `volume.ts` kapacitetu (jedan vlasnik).
5. 1b #2: napomena „dan kvaliteta ne sme biti duži od dugog" kad jeste (9 054 gen / 205 adapt) — tekst da vidi pod doze.
6. Z1, Z2 (interne oznake; „vi" → „ti" kao ostale distance; RECENT_LONG_TOO_SHORT poruka sa pragom max(10 %, 1 km)), Z3.
Nije na spisku: MP u taperu duži od dugog, lagan ≥ 0,9 × dugi, pauza 35 taper/trkačka, C6, C12, plauzibilnost (L1/L2).
