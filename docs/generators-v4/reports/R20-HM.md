# R20 — PODATAK HM (stanje `63faf2b0` → ovaj commit), 14. 11. 2026

Izmene samo u `distances/hm/` (safety, templates, library) i ispisima `plans/HM/`. Motor nije diran.

| profil | pre | posle |
|---|---|---|
| p03, p10 | 3 dana bez upozorenja | `malo-dana` sa brojem: p03 „4. dan od oko 40 min → 39,6 km", p10 „oko 45 min → 46,6 km" (`minRunDaysByLevel` bez `mali`/`spor`) |
| p06 | ned 6 (N−4) bez kvaliteta (0 %) | ned 6 prag 8 min; N−4 sa 5+ dana prag 0,33 umesto 0,42 (p04, p05, p07: 15 → 12 min) |
| p06 | ned 1 40,4 km (115 %) | isto — **MOTOR** (vidi niže) |
| p08 | ned 1 41,2 km (92 %); ned 14 → 15 46,0 → 53,0 (+15 %) | ned 1 44,7 km (99 %); 48,0 → 53,5 (+11 %); nalaz `ispod-cilja@14` nestao (`longStartShare['3']` 0,46 → 0,52) |
| p12 | najveći tempo trke 2 × 21 min u N−2 (17 dana pred trku) | N−3 blok 35 min, N−2 3 × 10 min (početnik: blok N−3 0,6 → 0,72, N−2 0,7 → 0,5) |
| p11 | N−2 3 × 9 min = najveći | N−3 blok 26 min najveći, N−2 20 min; prvi tempo trke 17 min = 65 % najvećeg (K7 drži) |
| P3 A, P1 B, p09, p10 | prvi prag 23 / 18 / 17 / 16 min u komadu | 3 × 8 / 3 × 7 / 2 × 9 / 2 × 8 min (biblioteka: `prag-oprez-*` za povratnika i tempo po osećaju; prag u komadu im samo do 11 min) |
| vlasnik-v2 | dugi 6 → 8 → 12 km | isto — **MOTOR** |

**MOTOR**
1. p06 ned 1 +15 %: 4 lagana × 30 min (pod `minEasyFallbackMin`) + dugi 13 km + prag. Kraći polazni dugi (podatak
   `longStartShare['5']` 0,27–0,30) motor rešava izbacivanjem dana (4 dana u ned 1–2, skok +19–22 %) i obara p04
   (ned 1 < 95 %) — vraćeno. Treba: ned 1 ≤ +10 % uz sve tražene dane (kraći dugi ned 1 bez ispuštanja dana).
2. vlasnik-v2: dugi posle trke — posle rampe oporavka (ned 1–2: 6, 8 km) ned 3 skače na plan (12 km); `longPlan` raste
   od dugih iz plana, ne od rampanih. Treba: dugi posle trke/pauze raste od poslednjeg rampanog + korak (8 → 10 → 12).
3. Tekst p06 upozorenja („plan ostaje na 4 dana", tri preporuke) — motor (trener § D3), nije diran.

**vlasnik-v1 (nalaz, plan nije menjan):** V4 ispis vlasnik-v1 nije iz adaptera — gradi se iz činjenica
(`testdata/owner.ts`, 30 km, 10 nedelja). Dugi ≤ 15 km dolazi iz lestvice vrha (25–35 km, < 12 nedelja → × 1,47) i
udela dugog; pad na 11,5 km u ned 4 je talas šablona (N−6: `len 0,81 × wave 0,85`). Zamrznut lični plan (HM v1) se ne dira.

Provera: V4 skup 1043 + 25 (64 fajla), typecheck 0, kapija HM 0; otisci 10K/MAR/5K bez promene; HM otisci p04–p12
namerno promenjeni (gornja tabela).
