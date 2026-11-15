# Glavni trener — krug 4, završna provera (11. 11. 2026)

48 planova iz `P9/plans/` (5k-v2.17.0, 10k-v2.16.0, hm-v2.14.0, marathon-v2.14.0), ista rubrika i skala. Svaki plan
upoređen nedelju po nedelju sa ispisom kruga 3: promenjeno je 11 planova, 37 je isto (ocena preneta). Po planu:
`ROUND-04.json`. Ograničenja ista kao ranije (AI ocenjivač, 12 profila po distanci).

## 1. Proseci

| | 5K | 10K | HM | MAR | ukupno |
|---|---|---|---|---|---|
| krug 1 | 54,7 | 55,0 | 55,3 | 53,6 | 54,6 |
| krug 2 | 58,0 | 59,2 | 60,9 | 57,7 | 59,0 |
| krug 3 | 59,0 | 60,8 | 61,4 | 58,5 | 59,9 |
| **krug 4** | **59,1** | **60,9** | **62,7** | **59,8** | **60,6** |
| krug 1 → 4 | +4,4 | +5,9 | +7,4 | +6,2 | **+6,0** |

Bolji 11, isti 37, slabiji 0 (u odnosu na krug 3).
**Iznad 70 (4):** HM p01 72,0; HM p02 71,0; 5K p01 71,0; 10K p01 70,5.
**Ispod 50 (1):** 5K p08 49,5. Na granici: MAR p11 50,0; 10K p06 50,5. (Krug 1: 14 planova ispod 50, najniži 31,0.)

Promenjeni planovi (krug 3 → 4) i šta se vidi u ispisu:

| plan | ocena | činjenica |
|---|---|---|
| MAR p08 (3 dana) | 47,0 → **54,0** | specifična faza: dugi 24,9 / 28,9 + 8 km MP / 24,9 / 29,3 + 10 km MP (talas), u nedelji bloka nema MP usred nedelje; lagan 17,4 km (0,70) |
| MAR p10, p03 (3 dana, spori) | 51,5 → **55,0**; 55,0 → **57,0** | dugi 17,8 / 21 + 8 km MP naizmenično; lagan 12,4 km |
| HM p08 (3 dana) | 53,0 → **58,0** | dugi 20,4 / 24 + 4 km RP / 20,4 / 24 + 6 km RP; u nedelji bloka dan usred nedelje lagan |
| HM p03, p10 (3 dana, spori) | 57,0 → **60,5**; 56,5 → **58,5** | dugi 13,3 / 15,7 + 4 km RP naizmenično |
| HM p11 (početnik) | 50,0 → **53,0** | dva lagana dana od 4,1 km → jedan od 6–8,1 km + „odmor ili 20 min po želji" |
| HM p06, MAR p06 | 56,0 → **58,0**; 55,5 → **57,5** | lagani 7,8–10,9 km (bilo 4,3–6,6) |
| 5K p06, 10K p06 | 51,0 → **53,0**; 48,5 → **50,5** | lagani 4,8–7,9 km u nedeljama gde su bili 4,3–5 km |

## 2. Pogoršanja u odnosu na krug 3

**Nema plana sa nižom ocenom.** Cena izmena, bez pada ocene:
- Mali obim: planirano je u nekim nedeljama ispod cilja (5K p06 ned 2: 22 km uz trenutnih 25), jer se dan „po želji"
  ne računa. Prihvatljivo — plan to kaže jednom rečenicom u zaglavlju.
- Tekst iste poruke o malom obimu ima tri različita oblika (zaglavlje, „Kratak lagan dan (subota)…", „Mali obim:
  2026-11-14 …" sa datumom u ISO obliku). Sitnica: jedan oblik, bez ISO datuma.
- B ne pokriva rasterećenja i taper (HM p11 ned 4, 9, 13, 17, 19: lagani i dalje 4,1 km; 10K p06 taper 3,1 km) ni
  planove sa jednim laganim danom (10K p11: 3–4 km). Zato p06/p11 ostaju 50–58, ne 60+.
- MAR p03/p10: blok 8 km MP u dugom od 21 km (53–57 min MP za sporog trkača, 38 % dugog) je gornja granica; ne dizati.

## 3. Završni sud po distanci

- **5K — da uz napomenu.** Dobar za 4–5 dana i ≥ 30 km/ned (p01 71, p02 66, p09 66,5). Za 3 dana i obim ispod 20 km
  bezopasan ali tanak: jedan kvalitet 3–15 min, dugi isti 10+ nedelja (p08 49,5 je jedini plan ispod 50).
- **10K — da.** Najujednačenija distanca; nijedan plan nije opasan. Slabost ostaje mali obim sa 5 dana (p06 50,5).
- **Polumaraton — da.** Za 4+ dana najbolji planovi programa (72 i 71); 3 dana sada imaju blok u dugom i talas
  (58–60,5). Napomena samo za početnika ispod ~25 km/ned: najduži dugi 13,6 km — plan to kaže.
- **Maraton — da uz napomenu.**
  - **3 dana: sada prihvatljivo (da uz napomenu).** Specifična faza ima talas i MP u dugom, a plan sam kaže „3 dana ne
    nose ovaj obim; preporuka 4–6 dana". Ostaje: u prvih 15 nedelja p08 dugi 25 → 29,3 km svake nedelje (50 % nedelje)
    i T 23 min × 12 — monotono, umeren rizik preopterećenja, ne opasno.
  - **Početnik ispod ~35 km/ned: i dalje „ne" kao priprema za maraton.** p11 je isti (najduži dugi 17,9 km, 37 km/ned);
    plan nosi preporuku, ali ona stiže posle generisanja. Prihvatljivo je pustiti ga samo ako ekran PRE generisanja
    kaže „za maraton treba oko 48 km/ned; preporuka polumaraton ili duža priprema" i korisnik potvrdi.

Opterećenja zbog kojih sam u krugu 1 pisao „povređuje ili pregoreva" (88 min RP, 95 km/ned za VDOT 35, 28 min MP u
trkačkoj nedelji, test od 23 min kao treći kvalitet nedelje) više nema ni u jednom od 48 planova.

## 4. Šta bi vredelo u nekom budućem krugu (najviše 3)

1. **Raspored specifičnog bloka (sve distance):** najteža nedelja po minutima rada 3 nedelje pred trku (5K/10K: 2),
   poslednja pred taper ≤ 85 %. Danas je najteža nedelja i dalje poslednja pred taper (HM p01 ned 14, 10K p01 ned 14,
   p04 ned 16). Procena +2–3 na ~8 planova (≈ +0,4).
2. **Monotonija kod 3 dana i dugih priprema:** „ista doza iste zone najviše 2 ne-rasteretne nedelje" (MAR p08 T 23 min
   × 12, MAR p10 T 19 × 10, 10K p10 T 13–15 × 12, 5K p08 R 4 × 400 × 3) i talas dugog i u razvoju maratona sa 3 dana,
   ne samo u specifičnoj fazi. Procena +3–5 na ~6 planova (≈ +0,5); podiže i jedini plan ispod 50.
3. **Mali obim do kraja + početnik maraton na ekranu:** pravilo B i u rasterećenju/taperu i za plan sa jednim laganim
   danom (lagan ≥ 30 min ili „po želji"); upozorenje pre generisanja za maraton ispod ~35 km/ned; test ≤ 2 × najveća
   dotadašnja doza za obim ispod 20 km/ned. Procena +2–4 na ~7 planova (≈ +0,4).

Dalje od toga dobit po krugu pada ispod 1 poena proseka; sledeći veći pomak ne dolazi iz pravila generatora nego iz
stvari van plana (gorivo i tempo trke za HM/maraton, pripremna trka, hod-trk za spore — ROUND-01 § 6).
