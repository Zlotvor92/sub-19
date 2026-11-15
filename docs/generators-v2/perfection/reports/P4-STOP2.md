# P4 — STOP 2: granica pravila O-b ne odgovara klasi degenerisanih ulaza (5K)

10. 11. 2026, 00:05 (Europe/Belgrade). Posle odluka organizatora uz STOP `42c24f7`. Kod je u radnom stablu (nije
pushovan): S1 + S2 + O-b (`policy.input.lowVolumeForPace`, `input.lowVolumeForPace`, kod `VOLUME_LOW_FOR_PACE` u ulazu,
assess A1, validatoru i Formi). Testovi nisu pokretani.

## Ispravka moje greške u `P4-STOP.md`

U opciji O-b napisao sam da pravilo „3 dana + < 13 km + VDOT ≥ 67" pogađa tačno 2 ulaza po VDOT-u. Netačno:
degenerisana su samo 2 (12 km, 6 i 7 nedelja), a pravilo odbija **svih 11 trajanja** (6–16 ned) za 12 km. Granica VDOT 67
je takođe iz celobrojne mreže; finija mreža pokazuje prvu degenerisanu nedelju već od VDOT-a plana **66,3**.

## Merenje (iz `web/`)

- **K6** fina mreža: 3 dana × 12,0–14,0 km korak 0,1 × 6–16 ned × VDOT 62–70 korak 0,5 = 3 927 ulaza
  (`node ../docs/generators-v2/perfection/P4/fine.ts`); **K7** bez pravila (fromVdot 99),
  VDOT 65,0–70,0 korak 0,1 × 12,0–13,5 km × 6–16 ned: WEEK_DEGENERATE samo za **12,0 km, 6 i 7 ned, VDOT plana ≥ 66,3**
  (76 planova; 12,1 km i više: 0).

| varijanta | odbijeno (K6, od 3 927) | WEEK_DEGENERATE (K6) | gusta mreža (K4): odbijeno po VDOT-u / WEEK_DEGENERATE |
|---|---|---|---|
| B1 = odluka (≥ 67, < 13 km) | 770 (12,0–12,9 km × sva trajanja, VDOT ≥ 67) | **2** (VDOT 66,5, 12 km, 6–7 ned) | 11 (v68, v70) / 0 na celim VDOT-ima |
| B2 (≥ 66, < 12,1 km = samo 12 km, dno tabele 3 dana) | 99 (12,0 km × 11 trajanja, VDOT ≥ 66) | 0 | 11 (v66, v68, v70) / 0 |
| B3 (B2 + trajanje ≤ 7 ned) | 18 (12,0 km × 6–7 ned, VDOT ≥ 66) — izvedeno iz K7 | 0 | 2 / 0 |

Sve tri varijante odbijaju samo ulaze koje je 5k-v2.12.0 ionako odbijao (VDOT > 60). B1 ne ispunjava uslov
„0 WEEK_DEGENERATE" (pada na VDOT 66,3–66,9). QUALITY_REDUCED (jedan kvalitet doze rasterećenja, nedelja 3, uz
upozorenje) ostaje za 12 km 6–7 ned na VDOT 62–66: K6 B2 16 planova.

## Pitanje

B1 (kako je odlučeno, uz preostale 2 degenerisane po VDOT-u 66,3–66,9), B2 ili B3? Do odgovora radim sabotaže, testove
i izveštaj sa brojevima kao parametrima politike (izbor menja samo `policy.input.lowVolumeForPace`).
