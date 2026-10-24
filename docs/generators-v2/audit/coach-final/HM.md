# Trenerska ocena početnog plana — polumaraton (HM) v2

Kod: vrh grane `claude/generator-isolation-5k-10k-hm-marathon` (policy `hm-v2/hm-v2.8.0`). Samo početni plan iz
profila (`distOf("HM").generate`), bez adaptacija, predaje i testova. Skripta: `HM-gen.ts` (iz `web/`:
`node ../docs/generators-v2/audit/coach-final/HM-gen.ts`). 21 profil: 17 planova, 4 odbijena ulaza (20 km/3 d,
110 km/6 d, početnik 3 d/18 km, početnik 5 d/20 km). Odbijanja su opravdana i jasno napisana.

Pokrivenost: 3/4/5/6 dana; obim 25–90 km; VDOT 33–65; po osećaju (2); početnik (1 plan, 2 odbijena);
10 i 20 nedelja; skorašnji najduži trk: bez podatka / 8 / 10 / 14 / 15 / 16 / 20 / 22 / 25 / 26 km; nerealan cilj;
dugi i trka subotom; profil korisnika (5K 20:25 → VDOT 48,6, 30 km, 4 dana).

## 1. Ocena: 7/10

Plan je stručno složen (tempa, faze, doze, rasterećenja, taper i raspored su dobri). Glavne slabosti: dugi trk
nosi 40–45 % nedelje na 3–4 dana; planovi na 3 dana ostaju bez ikakvog intenziteta poslednje 2–3 nedelje;
poruke korisniku su i dalje tehničke.

## 2. Problemi

| # | Problem | Primer (profil, nedelja, brojevi) | Profila | Bitnost | Činjenica / mišljenje |
|---|---|---|---|---|---|
| 1 | Na 3 dana poslednje ~3 nedelje nemaju intenzitet: rasterećenje bez kvaliteta, taper bez kvaliteta, trkačka nedelja bez oštrenja. Razlog: kruti procentni plafon (RP 2 × 2000 m = 16 % od 24,5 km > 15 %). | `02 3d-v40-25km`: n12 R bez kvaliteta, n15 taper 0 %, n16 bez oštrenja; poslednji kvalitet je n14, 13 dana pre trke. `01b 3d-v33`: n11, n13, n14 bez kvaliteta. | 2/2 (svi 3 d) | **bitno** | Činjenica (plan). Taper treba da smanji obim i zadrži intenzitet (Bosquet i sar. 2007, meta-analiza). |
| 2 | Dugi trk je 40 % nedelje na 4 dana i 45 % na 3 dana, u svim nedeljama. | `05 4d-v45-40km`: 22,4 od 56 km (131 min); `16 korisnik`: 16,8 od 42 km; `02 3d`: 15,7 od 35 km. Na 5 dana 32 %, na 6 dana 24–30 %. | 12/17 | **bitno** | Daniels: L do ~25–30 % nedelje ili 150 min. Mišljenje: na 3–4 dana veći udeo je delimično neizbežan, ali 40–45 % je gornja granica. |
| 3 | Kratak skorašnji najduži trk (8 km) smanjuje 1. nedelju sa 40 na 32,4 km (−19 %). Manjak ne ide u lagane dane. Poruka „Vrh 56,0 km umesto do 56,0 km" nema smisla. | `04 4d-v45-40km-rl8`: n1 cilj 32,4 (dugi 9, lagani 7,2), u upozorenju CAPACITY_LIMITED. | 1/17 (svaki profil sa kratkim RL na 4 d) | **bitno** | Činjenica (plan i tekst). Mišljenje: trkaču koji već trči 40 km ne treba seći obim; pravilo „lagani ≤ 0,8 × dugi" je prestrogo. |
| 4 | Početnik: najduži dugi je 14 km (98 min) za trku od ~2:08 (RP 6:05). Nema upozorenja LONG_RUN_SHORT, a plan na 3 dana sa 15,7 km ga dobija. Taper ima samo T 1,5 km, u trkačkoj nedelji nema oštrenja. | `15 pocetnik-4d-e420-25km-12w`: n10 dugi 14,0 km; n11 T 1,5 km; n12 bez oštrenja. | 1/1 | **bitno** | Činjenica: nedosledno upozorenje. Mišljenje: za početnika dugi treba da dođe do ~16–18 km ili ~2 h. |
| 5 | Poruke korisniku su tehničke i posle `userText`. | „plafon 10 % (odstupanje)", „poslednji ne-rasteretni", „Cilj po pravilu … nije izvodljiv u konstrukciji nedelje", „dugi ≤ max(1,1 × najduži, najduži + 1 km)", „T 3000 m" pored „T 3,0 km", „Vrh 56,0 km umesto do 56,0 km". | 17/17 | sitno | Činjenica. |
| 6 | Vrh je start × 1,4 i dostiže se rano. Duža priprema ne donosi ništa, samo plato sa istim dugim. | `08 4d-v45-20w`: vrh 56 km od n8; dugi 22,4 km 9 puta (n8–n18). `05`: 22,4 km od n9 do n14. | 6/17 (≥ 14 ned. na 3–4 d) | sitno | Činjenica (plan). Mišljenje: monotono, ali bezbedno. |
| 7 | Na 4 dana lagan dan je kratak (4,7–8 km), a nedelja ima 3 teška dana od 4 (2 kvaliteta + dugi). U specifičnoj fazi lagano je ~76 %. | `16 korisnik`: n1 lagan 4,7 km; n13–n14 teško 24 %, lagan 5,6–6,1 km. | 10/17 (4 d) | sitno | Mišljenje. Raspodela je na donjoj granici orijentira 75–80 %. |

## 3. Šta je dobro

- **Tempa** odgovaraju Daniels-u (provera uzoraka): VDOT 40 T 5:06; VDOT 50 T 4:15, I 3:55, RP 4:20 → 1:31:31.
  Za korisnika 5K 20:25 → VDOT 48,6 → HM 1:33:48. RP je izveden iz prognoze trke.
- **Doze** su u Daniels granicama: I ≤ 7 %, T ≤ 10 %, R ≤ 5 %. Doza raste postepeno (start → next → alt), deonice se
  smenjuju (kontinuirano / cruise / ponavljanja).
- **Faze** su logične: osnova R + T, razvoj I + T, specifična RP + T. Početnik ima 2 uvodne nedelje bez kvaliteta, pa
  T → RP, bez I i R.
- **Obim** raste ≤ 6 % nedeljno. Rasterećenje je svaka 4. nedelja (−20 %, jedan kvalitet), a posle njega obim
  je ~+6 % od nedelje pre rasterećenja.
- **Taper i trka**: taper −30 % uz RP i T ~60 %, trkačka nedelja −41 do −62 %, oštrenje RP 2 × 2000 m 3–4 dana pre
  trke i kratko lagano trčanje (3,4–5,4 km) dan pred trku (osim na 3 dana).
- **Raspored**: dva teška dana nikad nisu uzastopna, ni preko granice nedelje. Odmor je između kvaliteta. Dugi
  subotom uz trku subotom radi ispravno.
- **Dugi i skorašnji najduži trk**: početni dugi ≤ max(1,1 × RL, RL + 1). Bez podatka plan traži unos (napomena
  „pretpostavlja … bar 14,6 km"). Na 6 dana dugi je ograničen na 24 km (~1:45–1:55).
- **Po osećaju**: E po tempu, ostalo po RPE, test 5 km u 4. nedelji (u rasterećenju).
- **Ocena cilja**: jasna („traži 5,0 VDOT za 16 nedelja (ambiciozno ≤ 3,2)"). Odbijeni ulazi daju razlog i preporuku.

## 4. Šta bi trener promenio

- Na 3 dana i kod početnika zadržao bih bar kratak RP ili T u taperu i oštrenje u trkačkoj nedelji, makar
  2 × 1–1,5 km RP. Plafon u procentima ne treba da ukloni intenzitet iz poslednje dve nedelje.
- Dugi bih ograničio na ~30–35 % nedelje. Na 3–4 dana ostatak obima išao bi u lagane dane. Kada to ne staje,
  korisniku bih otvoreno rekao „za ovaj obim potreban je još jedan dan", umesto da dugi raste do 40–45 %.
- Kratak skorašnji najduži trk treba da ograniči samo dugi, ne celu nedelju. Trkač koji trči 40 km treba da
  krene od 40 km, sa više laganih km.
- Početniku bih dugi doveo do ~16–18 km ili ~2 h. Kad to nije moguće, isto upozorenje kao za ostale planove.
- Kod dugih priprema (≥ 16 nedelja) vrh bih postavio nešto više ili kasnije. U platou bih menjao dugi, npr.
  progresivni kraj ili poslednjih 3–5 km RP u specifičnoj fazi, umesto istih 22,4 km lagano 9 puta.
- Poruke bih pisao trkačkim jezikom („ove nedelje lakše, zadržavamo jedan tempo trening"), bez „plafona",
  „ne-rasteretni", formula i „cilj po pravilu", sa jednom jedinicom (km).
