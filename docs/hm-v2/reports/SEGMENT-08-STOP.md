# HM v2 — Segment 08 (hm-v2.6.0, pouka 37): STANI — skraćen dugi mešovite nedelje postaje stanje plana

Polazni SHA `e2e482e`. Kod NIJE commitovan: `artifacts/segment-08/p37-wip.patch` (radna verzija, sa privremenim
mernim prekidačem `P37_KEEP_LONG`), `src` vraćen. Staje se po tački 5 (sudar sa pravilom stanja iz upisanih dana,
pouka 29 / H5 / pouka 28 i pouka 33 — nijedna opcija nije očigledna).

## Šta je urađeno (patch)
| deo | mesto |
|---|---|
| jedina odluka o preostalim danima | `week.remainderWeek` (opcije: Q ostaje → Q2 lagan → Q1 lagan; test ostaje; pouka 35 bez tapera; inače najmanja struktura + upozorenje) |
| minimum / dužine | `lengths.mixedFloor100`, `lengths.remainderLengths`; `week.mixedMin100` (isto čita validator) |
| okidač „samo naniže" | zaštićeni dani > sastavljeni za te datume **i** zaštićeni + sastavljeni preostali > cilj (generator zaokružuje planirano do +0,05, pa samo „> cilj" menja i nemešovite nedelje — izmereno, odbačeno) |
| konstruktor | `generate.construct`: posle `make` poziv za nedelju sa prethodnim planom (upisani dani → stanje) |
| validator | `MIXED_WEEK_OVER` (upozorenje) / `MIXED_OVER_TARGET` (greška) iz `mixedMin100`; `doneDayIds` (urađen dan posle asOf, kao 10K/maraton) |
| invarijanta | `adaptInvariants`: mešovita nedelja sa danima posle asOf → planirano ≤ cilj ili upozorenje |

Nalaz organizatora (`mixed-deload.ts` HM, svaki 97. plan): planirano > cilj **291/449 → 0/449**, 0 odbijanja;
primer d3-10w-25km-v30-A-sat k3: 12,6 (upisan dugi) + 6,6 + T 5,12 = 24,32 → 12,6 + 4,3 + 4,3 = **21,2** (T ne staje:
lagan bi bio 3,48 km, pa Q1 lagan). „Rasterećenje nije niže od prethodne" 184 → 104: u svih 104 je već CILJ ≥
planirano prethodne nedelje (odluka cilja, volume.ts — van pouke 37).

## Sudar
Uzrok korak po korak (d3-r-10w, pauza 20, asOf sreda ned 4, cilj ned 4 = 21):
1. Zaštićen ponedeljak (lagan 12,1, iz starog plana) → ostatak 8,9 za sredu i nedelju.
2. Po pouci 33 lagani do 4 km, pa dugi skraćen 9,4 → **4,9 km**.
3. Ned 4 je izgradnja (ne rasterećenje) → `lastLong10` = upisani dugi 4,9 (pouka 29: stanje iz upisanih dana).
4. Ned 5 (rasterećenje): dugi = 0,8 × 4,9 → 4 km (A18 minimum) → lagani ≤ dugi → cilj spušten 21 → **12**.
5. Cilj sledećih nedelja raste od 12 (A2) → vrh 27,9 → **16 km**, taper 19,5 → 12, ceo plan „srušen".

Merenje (rana mreža 4a 193/97/29, svi asOf × 17 scenarija + lanac = 114 012 tokova; ciljana 16 275;
`artifacts/segment-08/reg37.ts`, `cmp37.ts`, `dir.ts`; heš bez napomena/upozorenja/verzije):

| | B: dugi se skraćuje (pouka 33 doslovno) | A: dugi preostalih dana se ne skraćuje |
|---|---|---|
| promenjenih tokova (svi sa mešovitom nedeljom planirano > cilj PRE) | 14 040 (+34 ciljana) | 11 513 (+16 ciljana) |
| promenjen drugi tok (bez takve nedelje) | 0 | 0 |
| nova odbijanja | 0 | 0 |
| tokovi sa promenjenim ciljem neke nedelje | **1458** (niže 1063, više 302, oba 93) | 334 (samo `chain/2`; više 319, oba 15, niže 0) |
| vrh plana niži | **481**, najviše **−22,1 km**; cilj nedelje do −49,7 km | 2, najviše −4,2 km |
| scenariji sa kaskadom | pause10 231, pause20 400, pause35 74, chain 730, painPause 23 | chain 334 |
| `mixed-deload.ts` HM planirano > cilj | 0/449 | 15/449 (svi sa upozorenjem; prosek +1,9, max 3,8) |

(A, `chain/2`: drugi korak lanca dobija viši cilj — mešovita nedelja prvog koraka ima manje km; uzrok nije
razložen do kraja.) Zaključak: B ispunjava „planirano ≤ cilj", ali kroz upisan (planiran, ne istrčan) skraćen dugi
ruši ostatak plana — suprotno nameri „samo naniže, manjak se ne nadoknađuje" (ne bi smelo da pomera buduće nedelje).

## Opcije
- **A — dugi preostalih dana ostaje (skraćuju se lagani do 4 km, pa kvalitet otpada); ne staje → planirano > cilj
  + MIXED_WEEK_OVER.** Nema kaskade kroz H5/pouku 28. Mana: odstupa od „dugi se skraćuje" (pouka 33) i ostavlja
  više nedelja iznad cilja (15/449 u nalazu). Trenerski: dugi je najvažniji trening nedelje — rezati prvo lagane.
- **B — kao pouka 33 doslovno (dugi se skraćuje).** Mana: kaskada iznad (1458 tokova, vrh do −22 km).
- **C — B, ali stanje (H5 `lastLong`, pouka 28 L) ne čita dugi skraćen ostatkom.** Dve definicije „poslednjeg dugog"
  (protiv pouke 24/29). Ne preporučujem.
- **D — B sa donjom granicom dugog = 0,8 × poslednji ne-rasteretni (dugi rasterećenja H5).** Blaža kaskada
  (sledeće rasterećenje 0,64 ×); nije mereno.

**Preporuka: A** (jedno pravilo, nula kaskade, upozorenje umesto odbijanja po pouci 14). Ostalo po zadatku
(trajna mreža, sabotaže, verzija hm-v2.6.0, DECISIONS, provere) radim posle odluke.

## Otvoreno (nezavisno od odluke)
- Dugi ≥ lagan važi među preostalim danima (kao `adaptInvariants`); zaštićen lagan (npr. 12,5 km) sme biti duži od
  preostalog dugog. Potvrda?
- Trkačka nedelja izuzeta (pouka 5/30 je njen vlasnik).

Komande (iz `web/`): `node <scratchpad>/mixdl.ts HM` (= `mixed-deload.ts` samo HM), `node reg37.ts <koren>
early <i> 4` (polazni u worktree-u `e2e482e`), `node cmp37.ts pre post early|targeted`, `node dir.ts pre post`.
