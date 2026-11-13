# R10 — krug 10 (motor), 13. 11. 2026

Kapije: HM 0, 10K 0, maraton 0, 5K 1 (p06, `it.fails` — stavka 15/20, predlog ispod). V4: 52 fajla, 944 + 25 očekivano pada. Ispisi osveženi.

## Najteža nedelja i dugi pred trku (PRE = plan bez događaja)

| scen. | PRE | POSLE 9b | POSLE k10 |
|---|---|---|---|
| HM s05 | 54.8 km / 124 min | 42.9 km / 94 min | 50.0 km / 124 min |
| HM s06 | 65.4 km / 130 min | 49.3 km / 116 min | 45.1 km / 111 min |
| HM s07 | 39.1 km / 115 min | 29.9 km / 100 min | 36.2 km / 108 min |
| HM s08 | 44.0 km / 95 min | 22.1 km / 75 min | 30.8 km / 95 min |
| HM s26 | 39.1 km / 115 min | 36.9 km / 108 min | 36.9 km / 110 min |
| HM s27 | 65.4 km / 130 min | 65.4 km / 130 min | 62.7 km / 115 min |
| 10K s05 | 54.0 km / 100 min | 54.0 km / 100 min | 54.0 km / 100 min |
| 10K s06 | 61.1 km / 110 min | 53.6 km / 110 min | 37.1 km / 70 min |
| 10K s07 | 25.9 km / 85 min | 18.1 km / 60 min | 22.5 km / 85 min |
| 10K s08 | 34.2 km / 75 min | 18.9 km / 55 min | 24.5 km / 65 min |
| 10K s26 | 25.9 km / 85 min | 19.6 km / 60 min | 21.7 km / 85 min |
| 10K s27 | 61.1 km / 110 min | 61.1 km / 110 min | 59.0 km / 95 min |

s06 (kasna bolest) i s27 (trka na ciljnoj dužini): niže od 9b namerno — stavka 5 (N−1 samo oštrenje 8–12 min, dugi 2. nedelje ≤ 70 %).

## Urađeno
1–3 geometrijski povratak (nedelja ≤ min(prvobitna, prethodna × 1,2), dugi + 25 % / + 20 min, kraj tek na prvobitnoj
nedelji; prognoza se pomera samo za izgubljene nedelje, sa rečenicom); 4 tekst (rezultat imenovan, star rezultat tiho,
s09 imenuje propušten tempo, jedina provera se pomera); 5; 6 + 9 (poslednja provera, jedan izvor tempa); 7; 8 (dan posle
provere lagan); 10 (`raceStartPaceOffsetShare`, HM 1–2 %); 11; 12; 14 (`longMaxSecByRunDays`, 10K srednji 3 dana 1 h 50);
18 (`vrh-ispod-obima`); 22; 26; 27 (maraton KNOWN prazan, 10K s26 skinut).

## Otisci promenjeni
10K p08 (14), HM svi (10: napomena dana trke), scenariji i parovi svih distanci (1–5); ostali profili netaknuti.

## Nije urađeno / predlozi (veća izmena modela)
- 13 (s03 prenos) i 21 (`longFatigue`): traže model umora dugog po nedelji — predlog: jedno polje u stanju, ne pravilo.
- 15/20 (p06: oslobođeno opterećenje u dugi, M7 prvo skraćuje lagane): globalni redosled M7 obara 56 testova i kapije
  HM 5 / 5K 7; predlog: redosled kao podatak distance (`trimOrder`), uvesti po distanci uz nove otiske.
- 23 (pripremna trka na dan dugog), 24 (srednje dugi dan), 25 (spajanje upozorenja): nov tip dana / spoj nalaza u
  čuvaru — zaseban segment.
- 16, 17, 19 (5K) nisu stigle; HM p08 bez `longMaxSecByRunDays` (dugi već 47 % nedelje).
