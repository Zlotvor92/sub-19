# HM v2 — Segment 02 (hm-v2.1.0): ZAUSTAVLJENO — pouka 28 (recentLongRunKm) × pouka 2 × H11 × H15

Grana `claude/generator-isolation-5k-10k-hm-marathon`, polazni SHA `30fcb4b`. Menjano samo
`web/src/domain/generators/halfMarathon/v2/**` i `docs/hm-v2/**`; HM v1, `halfMarathon/index.ts`, lični plan i druge
distance netaknuti. Zaustavni commit (kao HM-01 `faf8807`): ceo opseg HM-02 je urađen i zelen, osim odluke o sudaru
ispod. Test `recent.node` zato privremeno dozvoljava SAMO izmerena odbijanja sudara (ned 1, r ≤ 6 km, 3–4 dana).
Završni izveštaj `SEGMENT-02-IMPLEMENTATION.md` dolazi posle odluke organizatora.

## Sudar (izmereno: `node docs/hm-v2/artifacts/segment-02/measure-recent.ts`, 19 s)

Svaki broj dana × obim reda korak 5 × VDOT {30…80} × recentLongRunKm 5,0–20,0 korak 0,5, 12 ned, raspored A = 8928
ulaza → 61 odbijanje `WEEK_INFEASIBLE` u nedelji 1: 3 d 55 (r 5,0: 27; 5,5: 19; 6,0: 9), 4 d 6 (r 5,0: 4; 5,5: 2),
5/6 d 0; r ≥ 6,5 → 0. Dugi ned 1 ≤ max(1,1·r, r + 1) i lagan ≤ dugi (pouka 2) seku nedelju ispod praga u kome najniži
nivo kvaliteta staje u plafon H11. Primer 3 d, 35 km, VDOT 40, r 6,0: dugi i lagan ≤ 7,0 km, dan T 2,0 km = 5,89 km →
najveća nedelja 19,9 km, a T 2,0 km traži cilj ≥ 20,0 km (10 %). 4 d, 35 km, VDOT 30, r 5,5: dugi/lagan ≤ 6,5, T + R
dan 10,4 km → 23,4 km, a R 1200 m traži ≥ 24,0 km (5 %).

## Predlozi (odluka organizatora)

1. P1 — strukturisano odbijanje `RECENT_LONG_TOO_SHORT` (prag = najmanji r za koji je nedelja 1 izvodljiva;
   preporuka 10K ili izgradnja dugog). Bez novog broja; 61 odbijanje sa razlogom.
2. P2 — donja granica ulaza 5 → 7 km (`RECENT_LONG_INVALID`). Nov broj; mereno 0 odbijanja za r ≥ 6,5.
3. P3 — nedelja 1 bez kvaliteta kad granica ne nosi ni najniži nivo (odstupanje kao HI2). Nov sadržaj; nemereno.

## Urađeno (zeleno)

- H15 3/5/6 dana (tabela `days`); 3 dana jedan kvalitet T kont. → T cruise → RP bez I/R; HI6: rasterećenje T ≈ 60 %
  jedinog slota na Q1, taper samo RP, RP ≥ poslednje T, prelaz T kont. → T cruise bez ponavljanja strukture (10K D18).
- H13 dugi ≤ 24 km (LONG_KM); HI7 pouka 28 (ulaz 5–42 km, LONG_RECENT, napomena ned 1 sa pragom); HI8 izuzetak pouke
  9 (150 min, 24 km, skorašnji najduži; `week1LongCap10`); HI9 a–d; CAPACITY_LIMITED „preporuka 5–6 dana".
- Mreža 02 (16 896) K1 = 0, invarijante 0, `segment02.baseline.json`; gusta ned 1 (141 804) K1 = 0, K2 bez dugog
  na plafonu 0 (`artifacts/segment-02/k-metrics.ts`, 159 s).
- Regresija 4 dana prema 3979237 (`segment01.norm-hashes-3979237.json`): 2376 isti posle normalizacije teksta, tačno
  1320 promenjenih = dugi > 24 km u HM-01; drugih promena 0; vrh niži 0.
- 24 km pre/posle (`measure-24.ts`, 51 s): dugi > 24 km 660/1320/1320/1980 → 0; vrh niži 0; K2 i CAPACITY_LIMITED po
  obimu bez promene (4 d 774 → 774) — „kapacitet pada" se u mreži ne potvrđuje.
- Sabotaže `artifacts/segment-02/sabotage.json` 9/9 PAO (57,8 s); brz nivo v2 13 fajlova / 105 testova 15,5 s; pun
  nivo 22/23 zeleno pre privremene izmene `recent.node` (108 s); tsc, eslint, prettier čisti.
