# Krug 3 V4 HM — izveštaj (motor S1–S12, podaci T1–T8), 13. 11. 2026

Grana `claude/v4`. Testovi V4 + izolacija: **592 prolaze, 9 očekivano pada (`it.fails`), 0 pada**; `npm run typecheck`
čist. Kapija (`plans/gate.ts`, `distances/hm/gate.test.ts`, izmenjena po T7): **0 prekršaja, 14/14 prolazi**.

## Motor
| # | stanje | šta |
|---|---|---|
| S1 | urađeno | brz rad = kvalitet + blok u dugom (test/trka ne); budžet od planiranog zbira (do 4 ispravljena rasporeda), čuvar isto, tolerancija 0,5 pp; oštrenje van budžeta 8–12 min, uvek u nedelji trke |
| S2 | urađeno | `peakLadder` (podatak); korak + 7 % / + 2 km u minutima ≈ + 8 % / + 3 km stvarnih km; dugi + 10 min / + 1,5 km; prva nedelja = sadašnji obim; lanac rasta meri km |
| S3 | urađeno | `longShareLowVolume` (≤ 42 %, do 3 nedelje ≤ 45 %, ispod 45 km); nalaz + upozorenje `dugi-za-distancu` sa razlogom; tada procena bez napretka od obima (vrh = baza za `estimate`) |
| S4 | urađeno | doza = min(plafon nivoa, dosePct × udeo × vrh); prva doza podražaja ≤ 70 % plafona (K7) |
| S5 | delimično | R2b je već merio od nedelje gradnje; novo: obim nedelje (`volumeMin`) ograničava lagane dane i prihvatanje kvaliteta |
| S6 | urađeno | `form-update` samo iz signala `kvalitet`, ne u prozoru bola/bolesti/pauze ni uz takav događaj (s07, s15 više ne ubrzavaju) |
| S7 | urađeno | tempo trke iz potvrđene forme; druga rečenica „Ako provera forme D potvrdi…" samo ako je provera pred trkačem i bez „počni sporije"/po osećaju |
| S8 | urađeno | a) „Polazim od" i lanac iz stvarnih km/minuta (P3 A: 56 km, ned 1 50 km); b) polazni dugi ≤ najduže + korak (P3 A: 14,8 km); c) kvalitet samo krugovi/zadat/napor; d) `lagano-prebrzo`; e) tegoba → bez visokog udara 4 ned + `tegoba`, staž < 8 ned → raspon × 1,5 + `kratak-staz` |
| S9 | urađeno | dan pauze se ispisuje „pauza, bez treninga"; posle rampe ≤ 1,10 × pre (cela nedelja); pomerena provera ≥ 10 dana posle rampe ili otpada uz rečenicu; „lakši" samo kad je tačno; bez izmena laganih dana < 1 km i < 10 % |
| S10 | urađeno | `effort: 'race'` se usvaja cela (s03: 5 km na dan testa 3 km → tempa + 11 s/km); promena upozorenja je rečenica |
| S11 | urađeno | nalazi čuvara u `plans/HM/nalazi-cuvara.txt`, ne u planu; nedelja provere sa 3 treninga ima pravi razlog; zaglavlje objašnjava dugi na plafonu |
| S12 | urađeno | `distances/hm/round4.test.ts` (11 testova) + izmenjeni testovi motora; `F2-REPORT` § „Krug 4" |

## Podaci polumaratona
| # | stanje | šta |
|---|---|---|
| T1 | urađeno / delimično | p11 39 km (× 1,95), dugi 16,2 km; nivo `pocetnik-nov` (2:1, dugi hod-trk) za P2 B. Hod-trk je tekst laganog dugog (motor nema korak hoda u dugom) |
| T2 | urađeno | sve nedelje ≤ 22 %, vršne ≤ 25 % (najviše 25 %) |
| T3 | urađeno | talas 100/85/100/90 % kad dugi ne raste + progresivan dugi svake 3. nedelje osnove; test: nijedan dugi isti 4 nedelje zaredom |
| T4 | urađeno | p06 ned 9 tempo trke 2 × 1,5 km, ned 10 oštrenje; p11/v1/v2 oštrenje 3 × 3 min |
| T5 | urađeno | p06: prvi kvalitet nedelje zadržan (do + 10 % obima), `obim-za-nivo` sa predlogom 60 km |
| T6 | delimično | v1: vrh 36,3 km, dugi 15 km (cilj ≈ 16); v2: vrh 46,1 km (× 1,54), dugi 16 km (cilj ≥ 18 — ne stiže, udeo dugog ≤ 40 % iznad 45 km) |
| T7 | urađeno | kapija: vrh po tabeli trenera, udeo dugog po S3, brz rad 22/25 %, korak 10 % ili 3 km, HM ≥ 16 ned → dugi ≥ 15 km / 1 h 50 |
| T8 | urađeno | otisci 12 profila, 12 + 2 ispisa, 24 scenarija, 6 parova, `target-compare.md` |

## Po profilu (iz kapije)
| profil | vrh km (×) | najduži dugi | brz rad: najviše (vršna) | najveći udeo dugog |
|---|---|---|---|---|
| p01 | 55,0 (1,38) | 20,5 | 24 % (24 %) | 40 % |
| p02 | 54,4 (1,36) | 20,0 | 25 % (25 %) | 40 % |
| p03 | 38,8 (1,55) | 18,2 | 25 % (25 %) | 51 % (3 dana) |
| p04 | 69,2 (1,26) | 21,5 | 22 % (20 %) | 31 % |
| p05 | 111,2 (1,24) | 28,0 | 21 % (20 %) | 26 % |
| p06 | 43,4 (1,24) | 17,0 | 24 % (24 %) | 39 % |
| p07 | 73,0 (1,33) | 21,5 | 22 % (22 %) | 31 % |
| p08 | 48,5 (1,08) | 21,5 | 21 % (18 %) | 48 % (3 dana) |
| p09 | 61,8 (1,37) | 22,0 | 24 % (24 %) | 37 % |
| p10 | 39,0 (1,56) | 18,2 | 21 % (17 %) | 50 % (3 dana) |
| p11 | 39,0 (1,95) | 16,2 | 21 % (21 %) | 42 % |
| p12 | 60,8 (1,35) | 19,8 | 20 % (20 %) | 34 % |
| vlasnik-v1 | 36,3 (1,21) | 15,0 | 24 % (24 %) | 43 % |
| vlasnik-v2 | 46,1 (1,54) | 16,0 | 24 % (24 %) | 40 % |

(Najviši brz rad je u nedelji gradnje/vrha; nedelja trke se ne meri.)

## Otvoreno
- `target-compare`: 23 od 72 nedelje u tolerancijama (krug 3: 33). Ciljni planovi nose trenerovu grešku (p01 ned 13
  29 %), a nova pravila (brz rad 22/25 %, prva nedelja = obim, talas dugog) se od njih namerno razlikuju [srednja].
- „Ništa se nije desilo": p06, p08, p12 sada 1–3 s sporije (dodati u `FORM_DRIFT`, uzrok forma R12) — 9 `it.fails`.
- Motor meri obim u km preko laganog tempa, a cilj zadaje u minutima: brži rad kvaliteta daje do ≈ 3 pp više km
  (zato je u podacima 7 % i 2 km); čista mera bi bila cilj u km — za sledeći krug.
- Hod-trk dugi nema korake hoda (opterećenje malo precenjeno); P2 B dugi samo 11,3 km za 20 nedelja (× 1,5 od
  10,5 km stvarnih) — plan to kaže upozorenjem `dugi-za-distancu`.
- v2 dugi 16 km umesto ≥ 18: udeo dugog ≤ 40 % iznad 45 km ga drži; trener/drugi sudija da presude.
- S5 deo „udeo dugog od planiranog" i dalje računa km iz minuta (prag 42 km u podatku umesto 45).
- Wave i `pocetnik-nov` su novi podaci bez ocene trenera.
