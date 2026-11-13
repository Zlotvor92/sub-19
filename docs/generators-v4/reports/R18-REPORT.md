# R18 — motor, 13. 11. 2026 (po Beogradu) — stavke 1–5, 7, 9, 12, 13; 6, 8, 10, 11 nisu

Stanje `d904294`. Kapije HM/10K/5K/MAR 0. V4: 62 fajla, 1038 prolazi, 25 očekivano pada; lint i typecheck čisti;
ispisi (planovi, scenariji, parovi) svih distanci odgovaraju kodu. Novi testovi: `distances/paceDirection.test.ts`
(sve distance), `engine/m27.test.ts`.

## Urađeno
- 1 `9f01d58` smer tempa: posle rezultata oblik krive ostaje iz plana, menja se samo forma, pa se zone pomeraju
  srazmerno RP (5K S01: prag 4:46 → 4:38, RP 4:22 → 4:14, lagano brže). Prelom na rezultatu iz istorije dobija istu
  granicu naniže kao uneti rezultat (`zoneCapDown`; 5K S18 prag više nije sporiji). Tempo dana trke je iz forme, ne
  iz sporijeg cilja (namerno: MAR p17 4:15 → 4:11, test round5 S7).
- 2 `9f01d58`: rezultat sa trke duže od 2× cilja se prenosi na isti VDOT, bez dodatka krive (10K s17 46:10,
  s20 1:03:13). Nivo zadržan rezultatom (M17) se preklapa sa budućim napretkom (10K s03: 1:05 za 6 ned, bilo 1:36).
  Povratni test vlasnika prolazi.
- 3 `5c75f14` M5: pomerena provera ne zamenjuje tempo trke. Ide na drugi kvalitet ili lagan dan, inače otpada uz
  rečenicu (10K s07/s15/s16). Posle prave trke otpada (s26). Jedna linija u `tenk/r10` (izuzetak uz rečenicu).
- 4 `a996b12` tekst = izmena: 5K S11, S12; HM s26 „samo 9 dana"; brojač vidi napomenu za trku (`napomena-trke`).
- 5 `a9baeff`: oporavak posle trke nije povratak posle pauze. Lanac rasta i izlazak dugog ne kreću od skraćenog
  oporavka (MAR s17 vrh 65,6 → 80,4 km). Izbačena provera posle trke ≤ poslednji dugi (MAR s26 2 h 30 → 90 min).
  Namerno menjani: test round4 E (dugi ≤ trka) i otisak HM vlasnik-v2 (dugi +0,5 km).
- 7 `77b8306`: slabija trka sa druge dužine ≤ 28 dana posle bola ili pauze spušta formu upola (M19; HM s26
  2:05:42, bilo 2:07:13). Prvi trening zone posle bola ≤ 0,8 treninga posle kog je bol prijavljen (HM s13).
- 9 `ca03994`: „sada trčiš" iz km istorije (lažno upozorenje P3A nestalo); „podiže obim" samo uz vrh > 1,05 ×
  polazni (5K p08/p12/p14); „ciljaj" posle provere = očekivano vreme (HM p01 4:50, bilo 4:44).
- 12 `ca329c8`: „ništa" sa PROMENA 0 = bajt-isti plan i isti redovi u ispisu, za sve 4 distance (test u
  `distances/`, folderi 10K/MAR nedirnuti).
- 13 `d904294` M27: ručno premešten težak trening je činjenica; težak susedni dan menja mesto sa laganim, uz rečenicu.

## Nije urađeno
- 6: povratak na plan za 2 nedelje (75 %, 90 %) se sukobljava sa R2 (nedelja ≤ +20 %, dugi ≤ +20 min; pada 5
  testova). Pokušaj da pripremna trka posle bolesti otpada daje čuvarov nalaz `silazak` u MAR s7. Oba pokušaja
  vraćena. Treba odluka: da li R2 važi za kratku bolest, ili kraća rampa (`bolest: 2.0`). HM s15/s05/s25 nisu dirani.
- 8: 5K p06 ned 5 — kvalitet pada u `layoutWeek`, ni izostavljen lagan dan ne oslobađa mesto (`roomFor`).
- 10 (M22) nije započeto. 11: tempo trke N−2 = 0,5 obara K7 za p11 (vraćeno); p08 i p10 nisu dirani.
- Nivo-zavisno „bar 4 dana / 16 km / podigni na 75 km" (deo 9) traži podatak po nivou u svim distancama.
- 5K s26: „prvi brzi 21. 1." u rečenici o bolu je zastareo posle kasnije trke (tekst se ne preračunava).
