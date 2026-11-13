# R11 — krug 11 (samo 5 km), 13. 11. 2026

Kapije: 5K 0 (p06 bez `it.fails`), HM 0, 10K 0, maraton 0. V4: 53 fajla, 948 + 24 očekivano pada; lint i typecheck čisti.
HM, 10K i maraton bajt-isti: `git diff 02e06e1 -- distances/{hm,tenk,marathon} plans/{HM,10K,MAR}` = 0 linija
(otisci, ispisi, scenariji, parovi). Sve nove odluke motora su podaci; bez unosa motor radi kao do sada.

## Urađeno
- 15/20 `taper.trimOrder` (podatak): 5K `['scale','easy','long','quality']`. Kad su lagani dani i dugi na najkraćem,
  silazak (M7) skraćuje brz trening do najmanje doze i najkraćeg zagrevanja i hlađenja iz podataka. Dan i kvalitet
  ostaju. p06 N−2: 27,7 → 25,3 km (tempo trke 5 × 800 → 3 × 800 m). Otisak: samo p06.
- 16 `easyNotBelowMin` (podatak 5K): lagan dan zadat na `minEasySec` se ne zaokružuje ispod njega ni zbog plafona dana.
  Dan sa ubrzanjima ceo traje bar 20 min (bilo 15–18 min: p02, p06, p13, p15; „lagano 3 km / 18 min" kod p01, p05,
  p07, p09, p14). Otisci: 9 profila, uglavnom + 0,5 km lagano.
- 17 `doseRoundUnderCap` (podatak 5K): zaokružen rad ne prelazi plafon zone za više od 15 s. Kod deonica bira
  mogućnost sa više rada pod plafonom: deonicu manje ili kraću deonicu (npr. 10 × 300 → 9 × 300 m;
  5 × 1 km → 5 × 900 m). Kontinuiran rad i split zaokružuju naniže. Biblioteka: novi `prag-5x` (najmanje 25 min).
  `prag-4x` ostaje, jer 5 × 4 min gubi rad prema 4 × 6. Otisci: p01, p03, p04, p05, p07, p08, p09, p11, p16.
- 19 `ageRecovery` (podatak 5K: od 55 godina dan više): `birthYear` → `decisions.ageYears` + razmak brzih treninga
  ≥ 3 dana i rečenica „Godine (66): …" u zaglavlju. Bez `birthYear` ili bez podatka: ništa. p16 (4 dana: uto, čet,
  sub, ned) dobija jedan brz trening nedeljno, a oslobođeni obim nose lagani dani i dugi (vrh 28,8 → 32,2 km,
  × 1,29). Kapija prolazi.
- Ispisi `plans/5K` osveženi (43 fajla). Testovi: `fivek/r11.test.ts` (16, 17 nad profilima i mrežom; 19 sa i bez
  `birthYear`). Ručne sabotaže (isključen podatak) obaraju sva tri.

## Otvoreno / za sudije
- Isti podaci (`easyNotBelowMin`, `doseRoundUnderCap`, `trimOrder`) bi na HM, 10K i maratonu promenili 16–22 testa
  i otiske. Uključiti po distanci posle ocena sudija, uz nove otiske.
- 19: maraton p16 ima `birthYear` 1961; bez podatka `ageRecovery` u maratonu nema promene.
- `prag-5x` za sada ne bira nijedan profil 5K (rotacija unosa po mestu u šablonu). Ostaje u biblioteci za dozu ≥ 25 min.
