# Polumaraton v2 — ispravke posle provere (segment HM-09). Folder web/src/domain/generators/halfMarathon/v2/

Obavezno (B):
1. owner: bol 8 (odmor pokriva dugi ned 1) + umor u ISTOM koraku → WEEK_INFEASIBLE ned 2 (19 490/19 490; u dva koraka
   prolazi). Uzrok `assess.ts:441–446` noLong (prethodni plan) vs `generate.ts:246, 319–321` (upisani dani novog plana)
   → jedna funkcija „poslednji dugi pre nedelje w" iz upisanih dana. Cilj `audit/owner/hm-deloadref1.ts 1` → 0.
2. owner: recentLongRunKm + bol → umor → umor → DELOAD_LONG ned 3 (3 758/13 860). Jedna funkcija „referenca dugog
   rasterećenja nedelje w" (`generate.ts:246` vs `validate.ts:1280`). Cilj `audit/owner/hm-deloadref.ts 4 10,12,14,16` → 0.
3. owner: početnik `b-d5-12w-25km-e390-A` u 3 koraka → WEEK_INFEASIBLE ned 11 (6 + 8 tokova) — prvo potvrdi uzrok
   (sumnja `lengths.ts:247` vs `withEasy :266`), pa ispravi.
4. 1b #5 skok dugog: plafon skoka (`lengths.ts:46` rollingLongCap10) uzima L iz planiranih dugih i za nedelje za koje
   pokrivenost kaže da NISU trčane → primer HM 6 d 75 km painPause: ned 11 dugi 8,5 → ned 12 21,4. Pravilo pokrivenosti
   pouke 37 (dan poznat bez zapisa = 0) važi i za L skoka; nedelje 1–4 (pretpostavljeni skorašnji trk) ostaju.
   Cilj `audit/coach-hm-mar/measure-jump.ts HM 400 200 100`: iznad plafona iz stvarno trčanog → 0; `jump-example.ts`.
5. Z5b (app A1): MAR v2 početnik 45 km → HM cilj-početnik (20–40) WEEKLY_KM_TOO_HIGH → plan bez oznake početnika.
6. Z4 vraćanje revizije (izmeri; ispravi ako krši).

Jeftino (T/K, odlučeno):
7. 1b #1: pouka 35 i u taperu — dva dana kvaliteta duža od dugog → drugi postaje lagan (gen 1 446/24 852; adapt 997 bez
   upozorenja). Merenje `audit/coach-hm-mar/measure.ts` → zapiši pre/posle.
8. 1b #2: napomena „dan kvaliteta ne sme biti duži od dugog" kad jeste (909 gen / 546 adapt) — tekst da vidi pod doze
   (`week.ts:620`).
9. app A2 + C10: uvod „Uvod (H17): nedelja 1 od 2 … Dugi nedelje 3" (`week.ts:730`) → preformuliši da ne liči na broj
   kalendarske nedelje; `assess.ts:451` sirov broj → `wl(f)`.
10. Z1, Z2 (interne oznake 79/79 napomena; „.." u `WorkoutParts.tsx:134` je zajednički UI — NE diraj, javi), Z3.
11. owner K: `adaptInvariants.ts:343` min(40) → 20 (kao gridInvariants:456); fuzz F6: `gridInvariants.ts:403` DELOAD_LONG
    zna izuzetak pouke 32.
Nije na spisku: lagan ≥ 0,9 × dugi, pauza 35 taper/trkačka, C4, C11, C12, plauzibilnost ulaza (L1/L2).
