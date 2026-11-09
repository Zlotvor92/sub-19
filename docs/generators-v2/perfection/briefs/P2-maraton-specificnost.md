# P2 — maraton: specifičnost (MP u dugom, duži dugi)

Pročitaj prvo: `AGENTS.md`, `docs/generators-v2/perfection/PROGRAM.md` (pravila za tab, „Testovi"),
`reports/P0-REPORT.md` (MAR kolona), `reports/P1-STOP.md` i `briefs/P1-odluke-posle-stop.md` (pouke iz polumaratona —
isti obrazac, ne ponavljaj grešku), `web/src/domain/generators/marathon/v2/policy.ts` (M4, M6, M7, M7a, M10–M13a, M15,
pouke 28, 32, 35 ako postoji, A4, A5), STATUS maratona u `docs/marathon-v2/`.

Polazno (P0, planovi sa rezultatom, medijana): najveći MP trening 12 km (28,4 % trke); ukupno MP 52 km; najduži dugi
24,2 km / 143 min (57 % trke); dugih sa delom bržim od E 0/192; granica dugog je trajanje (M13 150 min), ne obim.

## Pravila (odluka organizatora; heuristike — tako ih označi u `policy.ts`)

**S1 — dugi sa MP blokom.** Redovan plan sa 4, 5 ili 6 dana; specifična faza; ne-rasteretne nedelje izgradnje. Poslednja
ne-rasteretna nedelja izgradnje (pred taper) je tip B; unazad se smenjuju (… A, B, A, B).
- Tip A (kao danas): Q1 = MP trening, Q2 = T cruise, dugi lagan.
- Tip B: dugi ima završni blok u MP; Q1 (dan MP treninga) postaje lagan dan (stanje MP slota se ne menja; obim raspoređuje
  vlasnik dužina); Q2 = T cruise po svojoj progresiji. Zahtevni dani nedelje B: T + dugi sa blokom.
- Lestvica bloka: 8 → 10 → 12 → 14 → 16 km, jedan nivo po nedelji B, ali blok nedelje B ≥ poslednja MP doza treninga kad
  takav nivo staje (ukupni MP ne sme da padne zbog smene). Granice: blok ≤ 50 % dužine dugog; trajanje dugog (E deo sporim
  E + blok u MP) ≤ vremenska granica dugog; ukupna dužina dugog je ona koju daje vlasnik dužina. Ne staje nijedan nivo →
  nedelja je A (napomena).
- MP trening (nedelje A) nastavlja lestvicu od poslednje MP doze treninga. „Glavna doza ne opada": poređenje unutar tipa
  (A sa poslednjom A ili nedeljom pre specifične faze; B sa poslednjom B); glavna doza = T + I + MP trening + blok; jedna
  funkcija za konstruktor i validator.
- 3 dana i početnik: nema nedelje B u ovom segmentu. Samo IZMERI (bez ugradnje u isporuku) šta bi dala varijanta „Q1 = T
  po lestvici, dugi sa blokom 6 → 8 → 10 → 12 km": % nedelja B koje staju, ukupni MP, odbijanja — u izveštaj.
- Rasterećenje, taper, trkačka nedelja: dugi uvek lagan. Po osećaju: blok nosi RPE kao MP.

**S2 — vremenska granica dugog.** Redovan plan: 150 → 180 min sporim E. Početnik: bez promene. Pouka 28 (skok ≤ 10 % / 1 km),
udeo po broju dana (M15) i upozorenje MARATHON_LONG_SHORT ostaju. Izmeri raspodelu najdužeg dugog (km, min, % trke)
pre/posle po VDOT-u i broju dana, i koliko planova više nema MARATHON_LONG_SHORT.

**S3 — adaptacija.** Bol („bez kvaliteta"): dugi sa blokom postaje lagan dugi. Umor (A5): dugi sa MP blokom se NE broji kao
lagan trening za RPE ≥ 7. Prinudno rasterećenje, povratak, nov start: dugi lagan dok nedelja nije redovna ne-rasteretna
specifična. Tip nedelje posle koraka adaptacije: iz rasporeda (poslednja ne-rasteretna nedelja izgradnje = B, unazad).

**S4 — prikaz.** `v2/app/`: naslov „Dugi 30,0 km: 18,0 km lagano + 12,0 km u maratonskom tempu", segmenti sa tempom; bez
internih oznaka u tekstu korisnika.

## Očekivano (prijavi pre/posle, skriptom P0 `measure.ts MAR` + svojim mrežama)

Najveći MP trening i najveći blok, ukupno MP po planu, broj dugih sa blokom po dužini pripreme, najduži dugi (km/min/%),
% km bržih od E u nedelji A i B, najduži dan nedelje u minutima, nedelje > 25 % brzih km (navedi, ne ispravljaj).
Orijentir (nije prag): ukupno MP ≥ 70 km medijana; najveći blok ≥ 14 km u planovima ≥ 60 km/ned; najduži dugi ≥ 28 km
za VDOT ≥ 45.

## Stani i javi (`reports/P2-STOP.md`, opcije sa brojevima)

Nova odbijanja ulaza koji su davali plan; ukupni MP medijana manja nego pre; sudar sa poukama 2, 9, 28, 32 ili „doza ne
opada" koji O1 ne rešava; nedelja B ne staje u > 10 % planova neke grupe 4–6 dana.

## Obavezno

- Stalni uslovi 1–8. Novi redovi u `policy.ts`, `policyVersion` naredna minor verzija. Samo `marathon/v2/**` +
  dokumentacija; druge distance, v1, CI fajlove i `web/scripts` ne diraj.
- Spisak promenjenih planova po klasi (`changed-<sha>.json` po postojećem obrascu). Sabotaže S1–S3 kroz
  `web/scripts/sabotage.mjs`, `--bail=1`.
- Testovi po odeljku „Testovi": namenski u toku rada; na kraju jednom `npm run check`, `--changed`, pun nivo samo
  `marathon/v2`, E2E maratona. Jedan push koda na kraju (`git pull --rebase` pre push-a; uporedo rade drugi tabovi u
  drugim folderima).
- STATUS maratona, izveštaj `docs/generators-v2/perfection/reports/P2-REPORT.md` (≤ 200 redova) sa ispisom profila (a)
  pre/posle i trajanjem svake komande testa.

## Kraj

Commit + push, pa `send_message` organizatoru: SHA, izveštaj, tabela pre/posle u 6 redova, otvorena pitanja.
