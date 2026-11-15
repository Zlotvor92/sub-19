# P1 — polumaraton: specifičnost (trkački tempo u dugom, veća doza RP)

Pročitaj prvo: `AGENTS.md`, `docs/generators-v2/perfection/PROGRAM.md` (pravila za tab, „Testovi"),
`reports/P0-REPORT.md` (HM kolona, „šta drži dozu"), `web/src/domain/generators/halfMarathon/v2/policy.ts` (H4, H5, H7,
H10–H13, HI15, pouke 32 i 35, A4, A5), `docs/hm-v2/STATUS.md`.

Polazno (P0, planovi sa rezultatom, medijana): najveći RP trening 8 km (37,9 % trke); ukupno RP u planu 30 km; dugih sa
delom bržim od E: 0/192; vrh RP drži plafon H11 15 % u 53 % planova, u ostalima kraj faze.

## Pravila (odluka organizatora; sve su heuristike, tako ih i označi u `policy.ts`)

**S1 — specifičan dugi.** U specifičnoj fazi, u ne-rasteretnim nedeljama izgradnje, nedelje se smenjuju: tip A, pa tip B,
pa A… (prva ne-rasteretna specifična nedelja je A).
- Tip A (kao danas): Q1 = RP trening, Q2 = T cruise (4–6 dana), dugi lagan. 3 dana i početnik: Q1 = RP, dugi lagan.
- Tip B: dugi ima završni blok u RP; RP trening te nedelje ne postoji. 4–6 dana: Q1 = I, doza = poslednja I doza razvoja
  (održavanje, ne raste, druga struktura dozvoljena), Q2 = T cruise po svojoj progresiji. 3 dana i početnik: Q1 = T po
  svojoj lestvici (nastavlja se od poslednje T doze).
- Blok: poslednjih X km dugog kontinuirano u RP; ukupna dužina dugog ostaje ona koju daje vlasnik dužina (`lengths.ts`).
  Lestvica X: redovan plan 4 → 6 → 8 km; početnik 2 → 3 → 4 km; po jedan nivo po nedelji tipa B. Granice: X ≤ 40 %
  dužine dugog; trajanje dugog (E deo sporim E + RP deo) ≤ važeća vremenska granica dugog (150 / 135 min). Kad nivo ne
  staje, najviši koji staje; kad ni prvi ne staje, nedelja je tip A.
- Plan po osećaju: blok nosi RPE kao RP (6–7). Rasterećenje, taper i trkačka nedelja: dugi uvek lagan. Poslednja
  nedelja tipa B je najkasnije poslednja nedelja izgradnje (taper se ne menja).
- Dan dugog sa blokom je zahtevan dan (`hard`): pravilo nesusednosti zahtevnih dana (H9) već važi za dugi; proveri.
- Glavna doza (H12 „ne opada"): RP rad nedelje = RP trening + blok u dugom; definiši jednu funkciju i koristi je u
  konstruktoru i validatoru.

**S2 — plafon i lestvica RP treninga.** H11 za RP: 15 % → 20 % cilja nedelje. Lestvica RP dobija nivoe 2 × 5000 i
3 × 5000 m posle 3 × 4000 m; druga struktura iste doze po postojećem pravilu (kontinuirano do 10 km ostaje). Pouka 32
(dan kvaliteta ≤ dugi) i ostalo iz H12 ostaju. Početni nivo RP (≤ 60 % plafona) se sada računa od novog plafona.

**S3 — adaptacija.** Bol (A4, „bez kvaliteta"): dugi sa blokom postaje lagan dugi iste nedelje (uz ostala ograničenja).
Umor (A5): dugi sa RP blokom se NE broji kao lagan trening za RPE ≥ 7 (to je kvalitet). Prinudno rasterećenje, povratak,
nov start: dugi lagan dok nedelja nije redovna ne-rasteretna specifična. Smena A/B posle koraka adaptacije: nastavlja
se po upisanim nedeljama (poslednja upisana ne-rasteretna specifična A → sledeća B i obrnuto); jedno mesto odluke.

**S4 — prikaz.** `v2/app/` (plan, dan, sat/izvoz ako postoji) mora ispravno da prikaže dugi sa blokom: naslov
„Dugi 20,0 km: 14,0 km lagano + 6,0 km u trkačkom tempu", segmenti sa tempom. Bez internih oznaka u tekstu korisnika.

## Očekivano (prijavi izmereno, pre/posle, istom skriptom P0 `measure.ts HM` + svojim mrežama)

Najveći RP trening, ukupno RP po planu, broj dugih sa blokom (po dužini pripreme i broju dana), % km bržih od E u
specifičnoj fazi, najduži dan nedelje, broj planova po uzroku vrha RP. Orijentir organizatora (nije prag): medijana
ukupnog RP ≥ 45 km, najveći RP trening ≥ 10 km u planovima ≥ 50 km/ned, ≥ 2 duga sa blokom u pripremi ≥ 12 nedelja.
Ako % km bržih od E u nekoj nedelji pređe 25 %, navedi koje i zašto — ne ispravljaj sam.

## Stani i javi (`reports/P1-STOP.md`, opcije sa brojevima)

Nova odbijanja ulaza koji su do sada davali plan; sudar S1/S2 sa poukama 2, 9, 28, 32, 35 ili H12; pad invarijanti
mreža koji nije direktna posledica S1–S3; nedelja tipa B koja ne može da se sastavi u > 5 % planova neke grupe.

## Obavezno

- Stalni uslovi 1–8 (`AGENTS.md`). Novi redovi u `policy.ts` (S1–S3: pravilo, mesto, obrazloženje „heuristika, odluka
  organizatora P1"), `policyVersion` hm-v2.9.0. Samo `halfMarathon/v2/**` (+ dokumentacija); druge distance i v1 ne diraj.
- Spisak promenjenih planova po klasi (bazne linije: nov fajl `changed-<sha>.json` po postojećem obrascu), dokaz da se
  planovi bez specifične faze sa RP (ako postoje) ne menjaju; baza/razvoj nedelje bajt-iste osim posledica S2 na početni
  nivo — izmeri koliko.
- Sabotaže: S1 (blok u rasterećenju/taperu; dva RP stimulusa u nedelji B), S2 (plafon 25 %), S3 (dugi sa blokom brojan
  kao lagan za umor) — kroz `web/scripts/sabotage.mjs`, `--bail=1`.
- Testovi po odeljku „Testovi" programa: namenski u toku rada; na kraju jednom `npm run check`, `--changed`, pun nivo
  samo `halfMarathon/v2`, E2E polumaratona. Jedan push koda na kraju.
- `docs/hm-v2/STATUS.md` (odeljak segmenta), izveštaj `docs/generators-v2/perfection/reports/P1-REPORT.md` (≤ 200 redova)
  sa punim ispisom profila (a) pre/posle i trajanjem svake komande testa.

## Kraj

Commit + push na radnu granu (uporedo radi T1 na CI fajlovima — pre push-a `git pull --rebase`), pa `send_message`
organizatoru: SHA, izveštaj, tabela pre/posle u 6 redova, otvorena pitanja.
