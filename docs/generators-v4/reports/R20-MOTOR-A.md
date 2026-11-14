# R20 — MOTOR A (prilagođavanje na događaje), 14. 11. 2026 (po Beogradu) — A1 urađen, A6 delom; A2–A5 nisu
Stanje `468ecca9` (+ ovaj izveštaj). V4: 69 fajlova, 1071 prolazi, 24 očekivano pada (polazno 64 / 1043 / 25; razlika
= novi testovi oba motora i tabova; jedan `it.fails` pretvoren u prolaz, v. dole). Typecheck čist, kapije HM/10K/5K/MAR 0.
Ispisi (planovi, scenariji, parovi) sve 4 distance obnovljeni posle poslednjeg rebase-a.
## A1 — urađeno (`e7f27ca0`, ispis `8e35a662`)
- Novo `engine/breakRamp.ts`: JEDNO pravilo posle prekida (pauza > 4 dana, bol ≥ 4, neplanirana trka, propušten dugi),
  u `replan` i u `plan` (plan iz stanja posle skorog prekida). Dugi raste ≤ max(+20 min, +15 %) od poslednjeg
  odrađenog / najdužeg posle prekida (6 nedelja); prvi brzi svake vrste u 14 dana od prvog brzog ≤ 70 % doze iz
  plana i ≤ poslednji odrađeni iste vrste (deonice se skraćuju do najmanje smislene doze; razlika vremena ide u
  hlađenje, pa nedelja ne gubi obim); blok u dugom ≤ poslednji odrađeni blok; nedelja posle rasterećenja ≤ +25 %
  (i ≤ 1,2 × najveće od tri, R2). Samo smanjuje, nikad ne dodaje rad; cilj izmenjene nedelje = planirano.
- Posle NEPLANIRANE trke povratak po nedeljama (kao R19 posle pauze), po dužini trke: ≤ 75 min → 85 %; ≤ 2 h → 60/80 %;
  ≤ 3 h → 50/65/80 %; duže → 40/55/70/85 % referentne nedelje (bez istorije: obim iz profila); dan posle trke ≥ 75 min
  odmor; raspored samo ako se završi pre nedelje −1. Stara pravila „dugi 2. nedelje 70 %" i `afterLongRace` ne važe
  uz raspored (jedan vlasnik odluke). Bez istorije dugih „poslednji dugi" posle trke = polazni dugi plana (ne 60 % trke).
- Svojstvo nad SVIM distancama `distances/breakRamp.test.ts` (dugi ≤ +20 min/+15 %; prvi kvalitet ≤ 70 % i ≤ odrađeni).
- Pre → posle: HM s07 dugi 65/70/110 → 65/70/90/110, nedelja 24 → 36,5 → 24 → 29,8; HM s05 dugi 79/73/115 → 79/73/97,
  prag 2 × 18 → 2 × 12 min, blok 27 → 17 min; MAR s05 30 km/12,5 km MP → 135 min (~24 km)/40 min MP; MAR s12 (dva
  propuštena duga) 2 h 25 → 3 h 07 → 2 h 22; MAR s17 posle polumaratona ned 1 18 → 32 km, s18 posle 10 km 22 → 38 km;
  HM vlasnik-v2 (dopuna organizatora) dugi 6/8/12/13,5 → 6,5/8,5/11,5/13,5/15 km.
- Namerno prepravljeni testovi: returnSchedule + hm/r14 (treća nedelja ≥ 85 % manjeg od plana i granice rasta, ne
  95 % plana); examples § 12 (d) (odmor 16. 11., ne 17. 11.); round4 E (lastLongSec 3660; dugi 2. nedelje ≤ 1. + 20 min);
  hm/r10 i tenk/r10 (dugi 2. nedelje ≤ referentni uz raspored); marathon/scenarios: `afterLongRace` test zamenjen
  testom rasporeda, `returnKeepLong` prihvata dugi na granici lanca; marathon/r9 KNOWN + s11 silazak, s11
  dugi-za-distancu, s12 silazak (niži vrh posle propuštenih dugih); hm/gate: vlasnik-v2 skinut sa „ČEKA FORMU"
  (sada prolazi); determinism dobio timeout 15 s (već je bio ~4 s od 5 s).
- Otisci: 5K p15 i MAR p15 (pauza zbog povrede pre plana → prvi brzi 70 %: 5K 7 × 300 → 5 × 300 m, MAR prag 16 → 11
  min). Ostali otisci profila bez promene.
## A6 — delom (`468ecca9`)
- `mergeChanges` u motoru: spisak dva uzastopna ponovna planiranja kao jedan (jedan dan / jedna nedelja — jedan red,
  „pre" iz prvog, dan vraćen na prvobitno ispada, isti red zaglavlja se ne ponavlja); lanci E7 svih distanci ga
  koriste; svojstvo `distances/changeList.test.ts`. HM s25/s26, 10K s25/s26, 5K s26, MAR s25/s26: duplikati nestali.
- NIJE: „stari događaj se ne ponavlja" (HM s08, 5K s08, MAR s08/s26 — tiho primenjen stari rezultat), rasterećenje
  posle trke (HM s19), „vršna" u prve 3 nedelje posle trke (5K s20); MAR s12 u jednom prolazu i dalje dva reda (spajanje
  u prolazu briše rečenicu „2 puta zaredom" — vraćeno).
## Nije urađeno
- A2 (put ≠ bolest, srazmerno danima; blok se pomera, ne briše; prognoza posle pauze), A3 (provera forme se pomera ≤ 2
  nedelje, zamena za trkača po osećaju), A4 (bol: lagan ≤ 65 % dugog, strogo manji prvi trening zone, gašenje posle 2
  nedelje), A5 (MAR s28/s09 N−2 24–26 km; s25 kvalitet u lagano). Uočeno: u nedelji 2 rasporeda lagani dani
  ponekad 18 min (primer § 12 d) — sečenje u `build` (korak „easy") ide ispod najmanjeg laganog dana.
