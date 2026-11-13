# R18 — motor, 13. 11. 2026 (po Beogradu) — stavke 1–5, 7, 9, 12, 13; 6, 8, 10, 11 nisu

Stanje: `d904294` i ovaj izveštaj. Kapije HM, 10K, 5K i MAR su na 0. V4 ima 62 fajla, 1038 testova prolazi, a 25
očekivano padaju. Lint i typecheck su čisti, a ispisi (planovi, scenariji, parovi) sve četiri distance odgovaraju kodu.
Novi testovi za sve distance su u `distances/paceDirection.test.ts` i `engine/m27.test.ts`.

## Urađeno
- 1 `9f01d58`, smer tempa:
  - Posle rezultata oblik krive ostaje iz plana, a menja se samo forma. Zone se zato pomeraju srazmerno RP.
    5K S01: prag 4:46 → 4:38 i RP 4:22 → 4:14; lagano je brže.
  - Kad je prelom na rezultatu iz istorije, zone imaju istu granicu naniže kao uz unet rezultat (`zoneCapDown`).
    5K S18: prag više nije sporiji.
  - Tempo dana trke se računa iz forme, a ne iz sporijeg cilja. Namerno su promenjeni MAR p17 (4:15 → 4:11) i
    test round5 S7.
- 2 `9f01d58`, prenos i napredak:
  - Rezultat sa trke duže od 2× cilja se prenosi bez dodatka krive, na isti VDOT. 10K s17 46:10, s20 1:03:13.
  - Nivo koji je rezultat zadržao (M17) se preklapa sa budućim napretkom. 10K s03: napredak je 1:05 za 6 nedelja
    (bilo 1:36). Povratni test vlasnika i dalje prolazi.
- 3 `5c75f14`, M5:
  - Pomerena provera nikad ne zamenjuje trening u tempu trke. Ide na drugi kvalitet ili na lagan dan; ako mesta
    nema, otpada uz rečenicu (10K s07, s15, s16).
  - Posle prave trke provera otpada (10K s26). Promenjena je jedna linija testa u `tenk/r10` (izuzetak sa rečenicom).
- 4 `a996b12`, tekst izmene odgovara stvarnoj izmeni:
  - 5K S11 („ostaje lagan", ne „već nosi"); S12 („nije duži od … pa ostaje").
  - HM s26: „samo 9 dana posle trke".
  - Brojač vidi napomenu za trku (`napomena-trke`).
- 5 `a9baeff`, oporavak posle trke nije povratak posle pauze:
  - Lanac rasta i izlazak dugog ne kreću od skraćenog oporavka. MAR s17: vrh 65,6 → 80,4 km.
  - Izbačena pripremna trka posle trke nije duža od poslednjeg dugog. MAR s26: 2 h 30 → 90 min.
  - Promenjen je test round4 E (dugi ≤ dužina trke umesto R2) i namerno otisak HM vlasnik-v2 (dugi +0,5 km).
- 7 `77b8306`, bol:
  - Slabija trka sa druge dužine u 28 dana posle bola ili pauze spušta formu upola (M19). HM s26: 2:05:42, bilo
    2:07:13.
  - Prvi trening zone posle bola je ≤ 0,8 treninga posle kog je bol prijavljen (HM s13).
- 9 `ca03994`, upozorenja i napomena za trku:
  - „Sada trčiš" se računa iz km istorije, isto kao zaglavlje. Lažno upozorenje P3A je nestalo.
  - „Podiže obim" stoji samo kad je vrh > 1,05 × polazni (5K p08, p12, p14).
  - „Ciljaj" posle provere je očekivano vreme. HM p01: 4:50 (1:41:53), bilo 4:44.
- 12 `ca329c8`: „ništa" sa PROMENA 0 daje bajt-isti plan, isti red očekivanog vremena i istu napomenu za trku, za sve
  četiri distance (test u `distances/`, bez diranja foldera 10K i MAR).
- 13 `d904294`, M27: ručno premešten težak trening je činjenica. Težak susedni dan menja mesto sa laganim danom iste
  nedelje, a trkač dobija rečenicu.

## Nije urađeno
- 6 (povratak MAR s07/s15/s16/s25):
  - Probao sam povratak na plan za 2 nedelje (75 %, 90 %). Sukobljava se sa R2 (nedelja ≤ +20 %, dugi ≤ +20 min;
    5 testova). Probao sam i da pripremna trka posle bolesti otpada; tada čuvar nalazi `silazak` u MAR s7. Oba pokušaja
    sam vratio.
  - Treba odluka: da li R2 važi za kratku bolest, ili da rampa za bolest bude kraća (`bolest: 2.0`).
  - HM s15, s05 i s25 nisu dirani.
- 8 (5K p06, ned 5 bez kvaliteta): kvalitet pada u `layoutWeek`. Ni izostavljen lagan dan ne oslobađa mesto
  (`roomFor`). Treba dozvoliti dva izostavljena dana ili kraći kvalitet.
- 10 (M22) nije započeto.
- 11 (HM p12 N−2): spuštanje tempa trke N−2 na 0,5 obara K7 za p11 (prvi RP ≤ 70 % vrha), pa sam ga vratio.
  p08 i p10 nisu dirani.
- Nivo-zavisno „bar 4 dana / bar 16 km / podigni na 75 km" (deo stavke 9) traži podatak po nivou u svim distancama.
- 5K s26: rečenica o bolu „prvi brzi 21. 1." je tačna u trenutku bola. Kasnija trka je pomera, a tekst se ne
  preračunava.
