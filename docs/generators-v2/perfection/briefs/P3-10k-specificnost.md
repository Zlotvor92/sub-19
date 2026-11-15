# P3 — 10K: doza trkačkog tempa i održavanje I

Pročitaj prvo: `AGENTS.md`, `docs/generators-v2/perfection/PROGRAM.md` (pravila za tab, „Testovi"),
`reports/P0-REPORT.md` (10K kolona), `reports/P1-STOP.md` i `briefs/P1-odluke-posle-stop.md` (pouke iz polumaratona),
`web/src/domain/generators/tenK/v2/policy.ts` (D4, D10–D13, D16, D18, D22, D30), STATUS u `docs/10k-v2/`.

Polazno (P0, planovi sa rezultatom, medijana): najveći RP trening 4 km (40 % trke); ukupno RP 15,4 km; plafon D11 RP 10 %
drži vrh RP u 55 % planova (3 dana 94 %); I u 36 % planova 5–6 dana ne raste iznad doze prelaza; u specifičnoj fazi I
nestaje.

## Pravila (odluka organizatora; heuristike — tako ih označi u `policy.ts`)

**S1 — plafon i lestvica RP.** Jedan plafon RP, tabela po cilju nedelje: cilj < 40 km → 10 % (kao do sada); cilj ≥ 40 km →
15 %. Lestvica RP se produžava do 8,0 km rada po obrascu postojeće lestvice (deonice 1000–2000 m, rastuća doza, bez
duplih doza); nove nivoe navedi u izveštaju. Ako obrazac nije jednoznačan, uzmi: … 6 × 1000 · 4 × 1600 · 5 × 1600 ·
4 × 2000 m (samo one čija je doza veća od trenutnog kraja lestvice). Pravilo „dan kvaliteta ≤ dugi" i ostalo iz D12/D16
ostaju.

**S2 — održavanje I u specifičnoj fazi.** Redovan plan 4–6 dana, ne-rasteretne specifične nedelje: Q1 = RP svake nedelje
(kao danas); Q2 se smenjuje: T cruise (tip A), pa I održavanja (tip B), pa A… Prva ne-rasteretna specifična nedelja je A.
I održavanja: doza = poslednja I doza razvoja, ne raste, druga struktura dozvoljena naizmenično. T slot nastavlja od
poslednje T doze u sledećoj nedelji A. „Glavna doza ne opada": poređenje unutar tipa (A sa poslednjom A ili nedeljom pre
specifične faze, B sa poslednjom B); RP slot ne opada iz nedelje u nedelju. 3 dana i početnik: bez promene.

**S3 — adaptacija.** Tip nedelje posle koraka adaptacije iz upisanih nedelja (poslednja upisana ne-rasteretna specifična A
→ sledeća B i obrnuto); jedno mesto odluke. Ostala pravila adaptacije se ne menjaju.

## Očekivano (prijavi pre/posle, skriptom P0 `measure.ts 10K` + svojim mrežama)

Najveći RP trening, ukupno RP, I minuti u specifičnoj fazi, % km bržih od E po fazi, nedelje > 25 % brzih km (navedi, ne
ispravljaj), uzrok vrha RP. Orijentir (nije prag): najveći RP trening ≥ 6 km u planovima ≥ 40 km/ned; ukupno RP ≥ 22 km
medijana.

## Stani i javi (`reports/P3-STOP.md`, opcije sa brojevima)

Nova odbijanja; sudar sa „dan kvaliteta ≤ dugi", poukama 2, 9 ili „doza ne opada" koji poređenje unutar tipa ne rešava;
nedelja B ne staje u > 10 % planova neke grupe.

## Obavezno

- Stalni uslovi 1–8. Novi redovi u `policy.ts`, `policyVersion` naredna minor verzija. Samo `tenK/v2/**` + dokumentacija;
  druge distance, v1, CI fajlove i `web/scripts` ne diraj.
- Spisak promenjenih planova po klasi; sabotaže S1–S2 kroz `web/scripts/sabotage.mjs`, `--bail=1`.
- Testovi po odeljku „Testovi": namenski u toku rada; na kraju jednom `npm run check`, `--changed`, pun nivo samo
  `tenK/v2`, E2E 10K. Jedan push koda na kraju (`git pull --rebase` pre push-a).
- STATUS 10K, izveštaj `docs/generators-v2/perfection/reports/P3-REPORT.md` (≤ 200 redova) sa ispisom profila (a) pre/posle
  i trajanjem svake komande testa.

## Kraj

Commit + push, pa `send_message` organizatoru: SHA, izveštaj, tabela pre/posle u 6 redova, otvorena pitanja.
