# HM v2 — STATUS

Novi generator polumaratona (policyId `hm-v2`) sa jednim vlasnikom svake odluke (H1–H15 iz
`docs/generators-v2/MASTER-HM-MARATHON.md` § 4), izolovan u `web/src/domain/generators/halfMarathon/v2/`. HM v1 je
nepromenjen i jedini u aplikaciji; `halfMarathon/index.ts` ne izvozi v2 do faze 2.

## Segment 01 (hm-v2.0.0): ZAUSTAVLJENO

- Izveštaj: `reports/SEGMENT-01-STOP.md`. Merenje: `node docs/hm-v2/artifacts/segment-01/measure-share.ts [udeo …]`.
- Sudar: H6/pouka 9 (nedelja 1 = trenutni obim; ispod samo uz dugi na 150 min) ↔ H13/H15 udeo dugog 35 %, lagan ≤ dugi,
  WU/CD H14, početni nivoi H12: mreža 01 396 / 3696 odbijeno (VDOT 30 pri 35/45/50/55/60 km, VDOT 35 pri 55 km).
- Predlozi P1 (udeo 0,38), P2 (0,40), P3 (izuzetak pouke 9), P4 (WU/CD) — odluka organizatora.
- Jezgro napisano (prototip); testovi segmenta, primeri i sabotaže posle odluke.
