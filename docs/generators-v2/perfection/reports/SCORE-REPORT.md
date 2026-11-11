# SCORE — automatsko merilo plana (11. 11. 2026)

Skripta `score/score.ts` (iz `web/`: `node ../docs/generators-v2/perfection/score/score.ts $PWD [5K|10K|HM|MAR] [--v3 <modul>]`)
zove generator (isti pozivi kao P9/render.ts), uzima OBJEKAT plana i računa 15 pokazatelja → ocena 0–100. Bez mreže, ~1 s za 48 planova.
Izlaz: `score/out/<D>.tsv` (pokazatelji + `s_*` po pokazatelju), `score/out/SUMMARY.md`. Kod aplikacije i testovi nisu diranj.

## Pokazatelji (definicije su u komentarima koda; „rad" = segmenti rep/continuous, bez WU/CD/oporavka/koraka; test se ne računa kao rad)
a plato dugog (±0,3 km, ne-rasteretne) · b dugi ned. 1 / najduži · c nedelja najvećeg rada, pre trke (cilj 3; ≤ 8 ned: 2) ·
d poslednja ne-rasteretna pre tapera / najteža (≤ 0,85) · e taper max / najteža (≤ 0,60) i rad trkačke nedelje (6–12 min) ·
f najduži niz iste doze iste zone (±3 %, cilj ≤ 2) + parovi istih nedelja · g km u trkačkom tempu (ukupno, u dugom), nedelje sa sadržajem u dugom ·
h vrh/start, najveći skok, najveći sati · i lagan/dugi (medijana, max) · j nedelje sa laganim < 30 min · k test: postoji/nedelja/jedini kvalitet ·
l najveća doza po treningu po zoni (R, I, T, RP/MP).

## Formula
ocena = Σ w·s, s ∈ [0,1] linearno između „cilj" (1) i „loše" (0) praga; težine u tabeli `W` na vrhu fajla (zbir 100):
vrh-položaj 9, rast 9, monotonija 8, iste-nedelje 8, trkački tempo 8, sadržaj u dugom 8, plato 6, pred-taper 6, taper 6, lagan/dugi 6, test 6, doza 6,
trkačka nedelja 5, kratak lagan 5, dugi-start 4. Pragovi su iz ROUND-01 § 3 / GAP § 2; dva su MOJA pretpostavka (nema ih u standardu):
udeo km u trkačkom tempu (min 4 % ukupnih km, MAR 3 %) i „sadržaj u dugom u ≥ 25 % nedelja izgradnje".
Težine nisu podešavane prema trenerovim ocenama (jedan prolaz, bez ponavljanja).

## Prosek (ROUND-04 verzije) i Spearman prema treneru
| | naš | trener | ρ |
|---|---|---|---|
| 5K | 67,9 | 59,1 | 0,11 |
| 10K | 69,8 | 60,9 | 0,37 |
| HM | 76,2 | 62,7 | 0,26 |
| MAR | 78,0 | 59,8 | 0,21 |
| ukupno (48) | 73,0 | 60,6 | **0,24** |

Zaključak [visoka]: merilo je SLABO usklađeno sa trenerom (ρ ≈ 0,24, a n = 12 po distanci je premalo za pouzdan ρ). Ne koristiti ga kao zamenu
za trenera na apsolutnoj skali (precenjuje 10–18 poena, najviše MAR/HM); upotrebljivo je kao detektor REGRESIJA istog plana (pokazatelj pre/posle).
Posle-hoc dijagnostika (ρ ocene prema trenerovim kategorijama, 48 planova) [srednja]: progression 0,62, specificity 0,48, taper 0,45 — dakle
slaže se oko oblika plana; fit 0,06, quality 0,08, clarity −0,14, recovery −0,23 — tu merimo drugo ili ništa.

## Pet najvećih neslaganja (detalji u SUMMARY.md)
- MAR p06 (mi 90, trener 57,5), MAR p03 (83 / 57), MAR p10 (80 / 55): mi ocenjujemo oblik (vrh, taper, doze) a trener „fit" i „quality": plan koji ne
  odgovara trkaču (spor, 3 dana, početnik, kratka priprema) kod nas gubi samo ~6–8 poena. Skripta ne vidi profil trkača osim satnog plafona.
- 5K p01 (mi 62,9, trener 71), 10K p05 (61,8 / 66,5): mi kažnjavamo plato dugog i sadržaj u dugom (−14 poena), trener to nema kao kaznu za ove profile
  (jak, dobro uklopljen plan; progression 5 je njegov najniži).
- Pokazatelj „iste nedelje" (f2) je 0 na svih 48 planova — ne razlikuje ništa u ovoj generaciji (zadržan kao sigurnosna mreža za v3).

## Ograničenja (šta skripta NE može)
- Tekst, jasnoća, tačnost napomena, trkački dan (tempo po delovima, ishrana) — nema pokazatelja (trener: clarity).
- Smislenost za konkretnog trkača (fit): prag po nivou je samo satni plafon; ne proverava tempo zona, lagan tempo, rezultat vs cilj, 3 dana.
- Kvalitet izbora vežbe (R/I/T oblik, oporavak, brda, fartlek) — meri se samo količina minuta rada, ne zašto.
- Pragovi su opšti (VDOT-nezavisni osim sati); I ≤ 20 min za VDOT < 40 i T ≤ 40 min za ≥ 80 km/ned nisu implementirani.
- n = 12 po distanci; težine su ručno zadate, ne kalibrisane.
