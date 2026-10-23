# Ugao 6 — aplikacija (E2E, sve 4 distance iza prekidača)

Kod: `670700e` (`git diff --stat 670700e HEAD -- web/` prazan pre merenja i pre izveštaja). `web/` nije menjan.
Seme slučajnosti: nema (svi ulazi fiksni, datum zaključan `fixToday`, polazni dan 2026-01-14, plan od 2026-01-19).

Pokretanje (iz `web/`, posle `npm run build`):
`npx playwright test -c ../docs/generators-v2/audit/app/playwright.config.ts`
(`node_modules` u ovom folderu je simbolička veza na `web/node_modules`, nije u gitu.)

Završni prolaz (`run-final.log`): **21 tok, 20 prošlo, 1 pao = nalaz A2** (`beginner-handoff.spec.ts`).
Dodatni prolazi početnika sa promenljivim ulazom: `run-beginner-40.log`, `run-beginner-45km-hm-10k-v2.log`.
Snimci: `shots/beginner-hm-week3.png`, `shots/beginner-hm-day.png` (ukupno ~290 KB). Trace fajlovi nisu commitovani
(`test-results/`, 3 MB).

## 1. Tabela pokrivenosti (postojeći E2E u `web/e2e/` → rupe)

| tok | 5K v2 | 10K v2 | HM v2 | MAR v2 | izvor | rupa → ovaj ugao |
|---|---|---|---|---|---|---|
| kreiranje (čarobnjak, rezultat) | ✓ | ✓ | ✓ | ✓ | `*-v2.spec.ts` | — |
| kreiranje po osećaju / odbijanje | odbijanje ✓ | ✓ / ✓ | ✓ / ✓ | ✓ / ✓ | `*-v2.spec.ts` | — |
| uvoz (backup izvoz → uvoz) sa planom v2 | ✗ | ✗ | ✗ | ✗ | `data.spec` samo v1 | **dodato** HM, MAR |
| prilagođavanje pregled → potvrda → revizija | ✓ | ✓ | ✓ | ✓ | `*-v2.spec.ts` | — |
| vraćanje verzije | ✗ | ✗ | ✓ | ✓ | hm/marathon-v2 | 5K/10K vraćanje nije pokriveno (nije dodato) |
| promena cilja (Ti → Cilj) | ✗ | ✗ | ✗ | samo vidljivo dugme | marathon-v2 | **dodato** sve 4 |
| predaja HM→5K v2, HM→10K v1/v2, MAR→HM v2 | ✓ | ✓ | ✓ | — | handoff-v2 | — |
| predaja MAR→10K v2 | | | | ✗ (POSLE-MERGE) | — | **dodato** (prolazi) |
| predaja MAR→5K | | | | ✗ | — | **dodato** — put ne postoji (A3) |
| predaja početnik MAR → kraća | | | | ✗ | — | **dodato** (A1, A2) |
| potvrda „primenjeno" | ✓ | ✓ | ✓ | ✓ | handoff-v2 | — |
| prekidač: vlasnik vidi / ostali ne | ✗ | ✗ | ✗ | ✗ | — | **dodato** |
| prekidač isključen = v1 | posredno | posredno | posredno | posredno | generator-ab-users | **dodato** sve 4 (policyId `*-v1`, bez objekta v2) |
| osvežavanje / perzistencija | delimično | delimično | delimično | delimično | handoff (a), ab-users | **dodato** (cilj, backup, predaja) |
| telefon, mali ekran | Pixel 7 (412 px) svuda | | | | config | **dodato** 320×568 (HM plan, pregled, odluka) |
| brojevi na ekranu = domenski plan | ✗ | ✗ | ✗ | ✗ | — | **dodato** sve 4 + cilj predaje |
| broj nedelje posle predaje (weekOffset) | naslov ✓ (HM→5K) | ✗ | ✗ | | handoff (a) | **dodato** MAR→HM, MAR→10K (naslov, stubići, tabela pregleda) |
| Reason/Violation.week prikazan | ✗ | ✗ | ✗ | ✗ | — | grep `features/`: polje se ne prikazuje; **tekstovi poruka** — A2 |
| v1 i lični plan bajt-isti | v1 ✓ | | | | generator-ab-users (zamrznuto), owner.spec (samo prikaz) | lični plan nije bajt-proveren (nije dodato) |

## 2. Šta je prošlo (bez nalaza)

- Prekidač: vlasnik (`OWNER` uid) vidi 4 prekidača v2, svi isključeni; običan korisnik ne vidi sekciju „Generator plana".
- Isključen prekidač: čarobnjak daje `5k-v1`, `10k-v1`, `hm-v1`, `marathon-v1` (verzija `*.1.0.0`), bez ključa v2.
- Brojevi: za 5K/10K/HM/MAR v2 (fiksni ulazi u `lib.ts` `INPUT`) svaki stubić „Pregled celog plana" = `plannedKm` v2
  zaokružen na 0,1; km svakog dana upisanog plana = `workout.km` v2 (0 razlika); dugi 1. nedelje na Plan tabu = dugi v2.
- Promena cilja v2 (sve 4): potvrda → revizija `reason: goal`, `policyId` ostaje, nedelje v2 bajt-iste, cilj posle
  osvežavanja prikazan.
- Backup HM v2 i MAR v2: izvezeni `genPlan` = serverski; posle uvoza lokalni = serverski = pre; Prilagodi plan radi (v2).
- **MAR v2 → 10K v2 kroz UI** (prvi put u E2E): maraton po osećaju (lak 5:15, 50 km, najduže 24, 4 d), prekidači MAR +
  10K, pauza 2025-12-24 → 2026-01-27. HM v1 nedostupan („traži rezultat"), ponuđen 10K v2 → `10k-v2`, `tenKV2Prefix.offset
  = 2`, nedelje 1..16 uzastopno, naslov „Nedelja 2 od 16", stubići = `plannedKm` uz pomak; posle pauze 2026-02-03…02-12
  tabela „Promenjene nedelje" 3–16 (kalendarski).
- MAR v2 → HM v2 isto (offset 2, tabela 3–15).
- 320×568: Plan tab, pregled pauze, odluka — `scrollWidth = clientWidth = 320`, nijedan element van ekrana.

## 3. Nalazi

| # | ugao | distanca | broj | ulaz koji ga reprodukuje | uzrok | klasa | predlog |
|---|---|---|---|---|---|---|---|
| A1 | app | MAR→HM v2, MAR→10K v2 | 1 tok (3 varijante rezultata) | čarobnjak MAR v2: 10 km **46:00** (VDOT ≈ 44), 2026-01-10, 45 km, najduže 18, **Početnik**, Uto/Čet/Sub/Ned, dugi Ned, trka 2026-05-10; prekidači MAR+HM(+10K); 2026-01-27 pauza 2025-12-24 → 2026-01-27 → primeni. Isto za 45:00 i 45:30. | Cilj nasleđuje `experience: 'beginner'` iz činjenica izvora (`halfMarathon/v2/app/handoffTarget.ts:94`, `tenK/v2/app/handoffTarget.ts:93`), a tabele početnika se razlikuju: MAR 4 d 25–45 km (`marathon/v2/policy.ts:456`), HM 4 d 20–40, 10K 4 d 18–35 → `WEEKLY_KM_TOO_HIGH` (`halfMarathon/v2/input.ts:206`, `tenK/v2/input.ts:211`). | **B** (predlog; T ako se poruka smatra dovoljnom) | Sa HM v2 + 10K v2: odluka nudi **nijednu** opciju; obe „nedostupne" sa porukom „…uz ovaj obim plan bez oznake početnika", a plan bez oznake se ne nudi. Sa 10K v2 isključenim nudi se 10K **v1** — uključivanje v2 oduzima opciju. Realan početnik, realan tok. Predlog: cilj sam određuje politiku (uslov 5) — iznad opsega početnika gradi plan bez oznake, kako poruka i kaže; ili uskladiti tabele. |
| A2 | app | MAR→HM v2 (cilj početnik) | 2 nedelje cilja (kal. 3 i 4) | isto kao A1, ali **40 km**; izbor „Kraća distanca: Polumaraton istog datuma"; Plan → Sledeća nedelja → Utorak → „Zašto ovaj trening". `shots/beginner-hm-day.png` | `halfMarathon/v2/week.ts:730` `nedelja ${frame.index}` (v2 indeks, bez `weekOffset`); ista rečenica dalje koristi kalendarski broj („Dugi nedelje 3"). Isti obrazac: `tenK/v2/week.ts:394`; čitanjem i `halfMarathon/v2/assess.ts:451` (`nedelja ${f}`, grana FATIGUE „ne primenjuje se") — ta dva nisu dostignuta u E2E (nepotvrđeno na ekranu). | **K** | Na ekranu dana kalendarske nedelje 3: „Fokus nedelje: Uvod (H17): nedelja 1 od 2 bez kvaliteta … Dugi nedelje 3 16,0 km …". Polja Reason/Violation.week se zaista ne prikazuju (POSLE-MERGE 3i tačno), ali v2 indeks curi kroz TEKST napomena. Predlog: `weekLabel` ili tekst bez broja („prva od 2 uvodne nedelje"). |
| A3 | app | MAR→5K | po dizajnu | MAR v2 po osećaju (A-tok 10K iznad), prekidači MAR + 5K (HM, 10K v2 isključeni) → odluka: HM i 10K „nedostupno (traži rezultat)", 5K se ne pojavljuje. | `marathon/v2/app/preparation.ts:30` `SHORTER = [HM, 10000]` (DESIGN O2a). | **K** (dokumentacija) | FINAL-2026-10-23 i brief broje par „MAR→5K 0/12 036" kao predaju; u aplikaciji taj put ne postoji. Ispraviti opis ili, ako je 5K željen (izvor po osećaju bez ijedne opcije), dodati ga. |
| A4 | app | MAR v2 po osećaju | 1 tok | MAR v2 po osećaju, lak 6:00, 40 km, najduže 18, 4 d; 2026-03-03 pauza 2026-01-27 → 2026-03-03 | `marathon/v2/shorter.ts:33–40`: ponuda samo ako je plan generatora za isti ulaz iznad praga 26 km. | **T** (po dizajnu, za odluku) | Pregled kaže „Cilj je orijentir … priprema nije potpuna (A3, M18)", ali kraća distanca se ne nudi, jer ni rođeni plan ne dostiže 26 km. Tekst i ponuda su neusklađeni za korisnika. |
| A5 | app | 10K, HM, MAR | svaka ocena cilja | Ti → Cilj → Promeni cilj (npr. 10K v2 43:00 → 42:00): „traži 2.4 VDOT … (realistično ≤ 1.2)"; HM: „traži 0.0 VDOT" | `tenK/v2/paces.ts:110–113`, `halfMarathon/v2/paces.ts:107–110`, `marathon/v2/paces.ts:122…` (`toFixed(1)` → decimalna tačka) | **K** | Ostatak UI koristi zarez („6,2 km"). „traži 0.0 VDOT" za cilj u nivou forme čudno zvuči. |
| A6 | app | HM v2 (verovatno sve) | svaka napomena nedelje | ekran dana (A2): „…(skorašnji najduži 18,0 km, pouka 28).." | `features/session/WorkoutParts.tsx:134` dodaje „." na napomenu koja već završava tačkom; napomene nose interne oznake (H17, pouka 28) | **K** | Bez duple tačke; oznake pravila van korisničkog teksta. |

Lažni pogodak, odbačen: regex broja nedelje je u pregledu posle predaje uhvatio „prva nedelja 1 kvalitet" (broj
treninga, ne nedelja). Tabela „Promenjene nedelje" je kalendarska. Regex je sužen (`lib.ts` `weekNumbersIn`).

## 4. Nije pokriveno (svesno)

5K/10K vraćanje verzije, lični plan bajt-isti (samo prikaz u `owner.spec`), osvežavanje usred pregleda prilagođavanja,
FATIGUE poruka HM cilja (A2, grana `assess.ts:451`) — traži unos RPE u dnevnik, nije rađeno.
