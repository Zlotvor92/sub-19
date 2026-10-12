# Završni QA: integracija sedam segmenata generatora

Datum: 12.10.2026. Draft [PR #43](https://github.com/Zlotvor92/sub-19/pull/43), grana `qa/generator-ab-final-seven`. Bez merge-a ili deploy-a.

## Zaključak

**B je bolji u ovom uparenom pregledu: A 6,82/10 → B 7,49/10.** Glavni ponderisani zbir je 68,205 → 74,865/100 (+6,660 poena). Svih deset stručnjaka odgovarajuće distance daje B višu ocenu, ali U09 napreduje samo jedan poen i ostaje kritično nedovoljna puna maratonska priprema. Visok broj zelenih testova ne poništava taj nalaz.

Završeno: deset zasebnih korisničkih agenata, četiri nezavisna slepa početna pregleda svih dvadeset planova (**80 ocena / 1.296 plan-nedelja**), zatim četiri zasebna pregleda svih deset događaja (**40 pregleda**). Validator potvrđuje nepromenjene početne score/report hash-eve, originalnih 94 QA fajlova i svih 309 produkcionih source fajlova kandidata.

**Trenerski zaključak je uslovan.** Doza iskusnih 5K/10K i HM progresija poboljšane su. Povratak je jasniji i čuva podatke. Prvi maraton U09 i maratonski rasporedi posle duže pauze ne dobijaju automatsku trenersku potvrdu. Ostaju i konkretna tehnička/product zapažanja ispod, uključujući jednu malu završnu HM-envelope neusaglašenost.

## Tačno poređenje i integracija

A je funkcionalni kod `f7bcbe99d135cd4c1e7b837d0369e8066c1b3baa`; B je integrisani kod `1a7571e98de4793688a037d5a62f912cae18adf2`. Svih sedam commitova potvrđeno je kao predak B. Integracija `33b732c` čuva i lanac #38–#40 i zaseban #41.

| Segment | Sadržaj | Commit | Draft PR |
|---:|---|---|---|
| 1 | finalization | `56269a6` | [#36](https://github.com/Zlotvor92/sub-19/pull/36) |
| 2 | fatigue-continuity | `1a7571e` | [#42](https://github.com/Zlotvor92/sub-19/pull/42) |
| 3 | session-purpose | `38ecc08` | [#37](https://github.com/Zlotvor92/sub-19/pull/37) |
| 4 | quality-dose | `548d1b1` | [#38](https://github.com/Zlotvor92/sub-19/pull/38) |
| 5 | hm-progression | `c2d1589` | [#39](https://github.com/Zlotvor92/sub-19/pull/39) |
| 6 | limited-preparation | `c1276d2` | [#40](https://github.com/Zlotvor92/sub-19/pull/40) |
| 7 | runwalk-form | `8d8004a` | [#41](https://github.com/Zlotvor92/sub-19/pull/41) |

Brojevi u tabeli odgovaraju segmentima popravki, ne hronološkom redosledu commitova. QA dodaje dokaze, probe, dve domenske regresije, browser test i zabranu automatskog deploy-a ove QA grane; produkcioni generator tokom ocenjivanja nije menjan.

Deset ulaza je byte-identično zaključanom `generator-ab/inputs.json`. Svih deset A planova reprodukuje originalni QA „new” hash; nema zamene A ranijom verzijom pre faze 1. Originalni `generator-ab/`, njegovi raw/blind/event/coach dokazi i raniji segmentni izlazi ostaju netaknuti. Novi izlazi su samo u ovom direktorijumu.

## Ocene po profilu

Glavnu ocenu daje stručnjak distance; sva četiri trenera ipak ocenjuju svih 20 planova. Rubrika ostaje 20/20/15/15/10/10/10 za uklapanje, kvalitet, progresiju, oporavak, specifičnost, taper i usklađenost. Ocene su subjektivne AI procene, ne procenat poboljšanja sportskog ishoda.

| Profil | Glavni ekspert | A /100 | B /100 | Razlika |
|---|---|---:|---:|---:|
| U01 — 5K početnik | 5k | 72.55 | 79.00 | +6.45 |
| U02 — 5K rekreativac sub-20 | 5k | 71.85 | 75.25 | +3.40 |
| U03 — 5K iskusan ambiciozan | 5k | 68.90 | 81.65 | +12.75 |
| U04 — 10K prvi specifičan ciklus | 10k | 68.00 | 71.00 | +3.00 |
| U05 — 10K iskusan | 10k | 70.75 | 79.00 | +8.25 |
| U06 — 10K povratnik sa starim PB | 10k | 57.25 | 68.25 | +11.00 |
| U07 — HM prvi, ograničena baza | hm | 73.50 | 82.50 | +9.00 |
| U08 — HM iskusan na rezultat | hm | 72.75 | 83.25 | +10.50 |
| U09 — Maraton prvi, mala baza | marathon | 54.25 | 55.25 | +1.00 |
| U10 — Maraton iskusan | marathon | 72.25 | 73.50 | +1.25 |

Proseci glavnih stručnjaka: 5K **71,10 → 78,63**; 10K **65,33 → 72,75**; HM **73,13 → 82,88**; maraton **63,25 → 64,38**. Jednak dopunski prosek svih 40 ocena/verzija je **69,211 → 75,797/100**.

Raniji QA je istom kodu f7bcbe9 dao 76,53/100 preko drugih nezavisnih ocenjivača. Ovde je taj isti A ponovo ocenjen na 68,205. Ne pretvarati razliku između krugova ocenjivača u dokaz regresije koda, niti mešati stare ocene sa novim uparenom skorom. Uporediv zaključak ovog kruga je A/B od istih četiri trenera. Mala razlika 1–3 poena je bliska ocena; nijedan score ne poništava kritični nalaz.

### Svih 80 početnih ocena

| Profil/verzija | 5K | 10K | HM | Maraton | Raspon |
|---|---:|---:|---:|---:|---|
| U01 / A | 72.55 | 63.50 | 75.75 | 75.00 | 63.50–75.75 |
| U01 / B | 79.00 | 74.50 | 80.75 | 81.25 | 74.50–81.25 |
| U02 / A | 71.85 | 73.25 | 76.50 | 78.25 | 71.85–78.25 |
| U02 / B | 75.25 | 74.75 | 79.50 | 81.75 | 74.75–81.75 |
| U03 / A | 68.90 | 67.25 | 73.00 | 73.75 | 67.25–73.75 |
| U03 / B | 81.65 | 76.25 | 82.00 | 84.00 | 76.25–84.00 |
| U04 / A | 72.90 | 68.00 | 76.25 | 75.50 | 68.00–76.25 |
| U04 / B | 75.75 | 71.00 | 78.75 | 78.50 | 71.00–78.75 |
| U05 / A | 71.05 | 70.75 | 74.25 | 74.50 | 70.75–74.50 |
| U05 / B | 79.30 | 79.00 | 82.00 | 83.00 | 79.00–83.00 |
| U06 / A | 63.55 | 57.25 | 67.00 | 67.25 | 57.25–67.25 |
| U06 / B | 72.55 | 68.25 | 76.00 | 78.25 | 68.25–78.25 |
| U07 / A | 70.70 | 70.00 | 73.50 | 72.50 | 70.00–73.50 |
| U07 / B | 81.75 | 79.50 | 82.50 | 83.25 | 79.50–83.25 |
| U08 / A | 73.15 | 68.25 | 72.75 | 72.00 | 68.25–73.15 |
| U08 / B | 83.80 | 79.50 | 83.25 | 84.75 | 79.50–84.75 |
| U09 / A | 53.65 | 44.75 | 53.50 | 54.25 | 44.75–54.25 |
| U09 / B | 54.35 | 45.75 | 54.00 | 55.25 | 45.75–55.25 |
| U10 / A | 68.65 | 67.75 | 73.00 | 72.25 | 67.75–73.00 |
| U10 / B | 70.75 | 71.25 | 75.75 | 73.50 | 70.75–75.75 |

Score JSON-i čuvaju i sedam kriterijuma, svaku pregledanu nedelju, konkretne dane, snage i primedbe. [score-lock.json](score-lock.json) čuva originalne hash-eve pre otkrivanja identiteta. [summary.json](summary.json) sadrži računljiv zbir i X/Y mapiranje.

## Rešeni nalazi i proverena ponašanja

| Nalaz | Pre A | Posle B / dokaz |
|---|---|---|
| Opis, fokus i upozorenja posle guard-a | Struktura uklanja brz rad, a tekst zadržava ubrzanja i stare kvalitetne fokuse | Budući nezaštićeni propisi finalizuju se iz isporučene strukture. U06 stale stride opis 2→0, semantički stale fokus 6→0; U10 opisi 4→0. Pikovi i broj stvarno lakih nedelja se usklađuju. |
| Umor bez pauze | U03 gubi kontinuitet 24→0, neposredni W8 deload postaje radna nedelja | Kontinuitet ostaje 24, readiness `fatigued`; 26.11–6.12 bez kvaliteta/ubrzanja i bez povećanja doze; W8 ostaje deload, 38,0 km. |
| Manji izvršeni obim | U02/U07 kontinuitet 12→0, povratni tekst i bez prijavljene pauze | Kontinuitet ostaje 12; `reduced-volume`, bez izmišljene pauze; baza prati izvršenje. |
| Svrha RP/aktivacije i kratkih I deonica | RP pauza prolazi kroz legacy I tumačenje; etiketa aktivacije ne prati njen tempo | Svrha/zona postoje pre doziranja. RP builder pauze ostaju; aktivacija je kontrolisana RP. I rad se ograničava prema stvarnom trajanju. |
| Iskusni 5K/10K stimulus | Više konzervativnih koraka kumulativno skraćuje rad | U03 W5 ukupno 23,51→35,26 min kvalitetnog rada; U05 razvija kasni RP na 4,8 km uz kratke pauze. Taper doza nije proizvoljno pojačana. |
| HM progresija | Kasni mali HM blokovi, duge pauze i neujednačen taper | Odvojene prve/performance HM putanje, duži T blokovi, raniji HM ritam, kratko lagano trčanje u pauzi; LR finish računa se kao kvalitetan dan. Ostaje jedan završni envelope nalaz. |
| Limited/rejected ciklus | Odbijanje čuva stari plan, ali nema konkretan sledeći izbor | U08 primarno ostaje odbijen (8<10 nedelja), ali ima preview za pomeranje, 10K ili bazni režim. U09/U10 eksplicitno nisu puna maratonska priprema i nude realne alternative. |
| Početnički prelaz i stari PB | U01 izlazi iz run/walk po kalendaru; U06 numerički stari PB izgleda obavezujuće | U01 kontinuitet je probni sa rezervom/hold/repeat opcijama; U06 effort-first i objašnjeni referentni ritmovi. Gate je savet, ne tvrda blokada budućeg statičnog plana. |

## Konkretne pre/posle sesije

| Profil / sesija | A | B |
|---|---|---|
| U01 W5 ponedeljak | 2,9 km @~8:38 +6×20 s ubrzanja | Ista 2,9 km; bez ubrzanja. Neprekidno trčanje je probno samo uz razgovoran napor ≤5/10 i bez bola; inače ponovi 5:1. |
| U03 W5 utorak | 2×1.200 m @3:57, 213 s hoda, 2 km WU +1,5 km CD; ukupno 6,1 km | 3×1.200 m, isti tempo i pauza/WU/CD; ukupno 7,4 km. Povećan rad prema iskustvu, bez automatskog ubrzavanja. |
| U05 W13 utorak | RP 3×1.200 m @4:30, pauza 240 s; 2,9 km WU +2,4 km CD | RP 4×1.200 m @4:30, pauza 60 s; 2 km WU +1,5 km CD. Više specifičnog rada, manje padding-a. |
| U08 W1 utorak | T 2×1.000 m @4:23, 60 s jog; ukupno 8,7 km | T 2×2.000 m @4:23, 75 s jog; ukupno 10,7 km. |
| U06 povratak, 30.11 | Struktura bez strides, opis ipak traži 6×20 s | Ista 2,2 km; opis effort 3–4/10, razgovorno, ritam samo gornja granica starog rezultata. |
| U03 fatigue W8, 30.11–6.12 | 48,8 km, 2,25 min kvaliteta, izgubljen deload | 38,0 km, 0 min kvaliteta/ubrzanja, deload. Originalni zaključani plan pre događaja imao je 40,2 km. |

WU/CD su zagrevanje/hlađenje. Intervalni oporavak 213 s u U03 se nije menjao; ne mešati ga sa popravljenim RP oporavkom U05. Ovo su konkretni isporučeni primeri, ne univerzalne fiziološke preporuke.

## Deset događaja i nezavisni sudovi

Glavni replay koristi **identične istorijske current/log/context/opcije/analizu** preko A i B; ne rekonstruiše log prema novoj propisanoj distanci. Primarni i kontrolni slučajevi ostaju odvojeni.

| Profil | Primarni događaj i rezultat B |
|---|---|
| U01 | Jedan propušten trening → savet, bez nepotrebne regeneracije. Hold/step-back/repeat i obe istorijske log verzije su zasebne kontrole. |
| U02 | Dve pune nedelje 55% obima → smanjenje, kontinuitet 12, bez pauze. 45 primarnih /49 supplemental zaštićenih dana. |
| U03 | Dva poslednja easy RPE8 → neposredni datirani oporavak, kontinuitet 24. Pozitivan dokaz forme i faster gate provereni zasebno. |
| U04 | Potvrđena 7-dnevna pauza → početni povratak bez kvaliteta, kontinuitet 8; postojeća merenja i datumi čuvani. |
| U05 | Cilj 42→40 min → cilj promenjen, potvrđena forma nije ubrzana. Sva završena/manual/measured/PRED/QS istorija sačuvana. |
| U06 | Pauza 28 dana → četiri kalendarske povratne nedelje, osam dostavljenih početnih lakih nedelja zbog male baze; stvarni vrh 10,1 km/ned i LR4 km. Stari PB ostaje orijentacija. |
| U07 | Dve pune nedelje 60% obima → kontinuitet 12; limited HM, vrh36,1/LR12,3, nije potvrđena puna priprema. |
| U08 | 25.11, pauza14 dana → A/B odbijaju pun HM ciklus; nema result-a ni mutacije. Novodobijene alternative grade se tek kao odvojeni preview-i. 28.10 ostaje zaseban raniji slučaj. |
| U09 | Pauza14 dana → kontinuitet12, limited maratonski povratak, vrh29/LR8,8. 10K/bazni izbor su konkretni; puna produžena priprema nije izmišljena. |
| U10 | Pauza28 dana → kontinuitet32, vrh47,4/LR17,3, četiri početne lake nedelje. U protection primeru postoje sačuvani konflikti: stvarno samo jedna početna potpuno laka nedelja, pošteno prijavljeno. |

Četiri event presude za B (ne nove početne ocene):

| Profil | 5K trener | 10K trener | HM trener | M trener |
|---|---|---|---|---|
| U01 | prihvatljivo | prihvatljivo | uslovno | prihvatljivo |
| U02 | uslovno | uslovno | uslovno | uslovno |
| U03 | uslovno | uslovno | uslovno | uslovno |
| U04 | uslovno | uslovno | uslovno | uslovno |
| U05 | uslovno | uslovno | uslovno | uslovno |
| U06 | primedba | primedba | primedba | primedba |
| U07 | uslovno | uslovno | uslovno | primedba |
| U08 | uslovno | uslovno | uslovno | uslovno |
| U09 | primedba | kritično | kritično | kritično |
| U10 | primedba | kritično | primedba | kritično |

„Uslovno” znači prihvatljiva adaptacija uz ograničenja, ne potvrđena spremnost. Kritični U09 početni nalaz postoji kod sva četiri trenera. Posle pauze 10K/M treneri označavaju i U10 kao kritičan ako se zadržani maraton tumači kao preporuka; drugi ga označavaju kao važnu primedbu. To neslaganje ostaje vidljivo. Detalji: četiri `coaches/*-events.json/md` i [event-review-summary.json](event-review-summary.json).

## Očuvanje i konflikti među popravkama

- Prošlost i tekući cutoff, završeni budući treninzi, actual km/sec i efektivni datumi čuvaju se nezavisno od novog propisa. U05 primarni log ima 33 done unosa, 336,9 stvarnih km i106.931 sec; stres-log 34 unosa, 346,3 km i109.309 sec ostaje tačan.
- PRED/QS i merom zaključani redovi sačuvani su gde zaista postoje. U04 ima osam nonempty measured pred/lock vrednosti; U05 stres čuva zaključan budući row i ručne kind/WU/alt izmene. U06 primarni pred/predLock su prazni, elapsed sec nedostaje: taj fixture sam ne potvrđuje očuvanje postojećih vremena/merenja. Prazne kategorije ne računamo kao dodatni dokaz.
- Stare protection analize u U02/U04/U07 namerno prethode dodatim zaštitnim sentinelima; stoga recomputed analysis može odstupati. U04 zahtevano pomeranje kolidira i ostaje neefektivno. To je zapisano ograničenje supplemental fixture-a, ne dokaz gubitka datuma ili test stvarnog povratka.
- Nove dve integracione regresije prolaze ceo lanac umor → cilj → merena rekalibracija → base choice → JSON revizija → restore, sa i bez zaštitnih konflikata. Active recovery ostaje, brži rad ne zaobilazi guard, a protected sadržaj i stvarni log ostaju. Ovo direktno proverava međusobni uticaj segmenata.
- Sačuvan future manual/measured kvalitet nije tiho obrisan da bi se ulepšao oporavak. Konflikt je vidljiv; u U09 protection rezultat ima dve stvarno lake nedelje umesto tri, U10 jednu umesto četiri. U08 zasebni izborni sentineli takođe ostaju sa eksplicitnim konfliktima.

## Otvoreni nalazi, regresije i ograničenja

| ID | Vrsta / prioritet | Konkretan nalaz | Predlog za sledeći prozor |
|---|---|---|---|
| R01 | Trenerski kritično | U09 oba početna plana: LR17,7 km/~105 min pre42,2 km; posle pauze LR8,8. Limited upozorenje ne stvara izdržljivost. | Početni limited marathon kao eksplicitna odluka o baznom radu/kraćoj distanci i ponovnoj potvrdi baze; zadržani race row ne predstavljati kao trenerski odobrenje. |
| R02 | Trenerski / product | U10 povratak LR17,3 i U06 10K povratak LR4 uz zadržanu trku. Recovery window istekom ne potvrđuje oporavak ili spremnost. | Response-based nastavak, izričit novi cilj/date/distance izbor i potvrda tolerancije. |
| R03 | Tehnički integracioni nalaz | **U08 W11** stvarni brzo-radni teret47,5433 min, dok sopstveni envelope preko konačnih70,6 km, E316 s/km,14% i90%-LR faktor daje46,85016 min: **+41,5904 s /1,48%**. Per-session ceilings prolaze. | Završna provera weekly envelope posle konačne raspodele/rezanja i finalizacije; posebno regresioni ulaz U08 W11. Ne skrivati nalaz zelenim unit testovima. |
| R04 | Product / trenerski | U08 base mode nema taper u W13; LR16 km sedam dana pred HM. U09 base i dalje ima42,2-km race row bez cilja. `fullPreparation:false` mora ostati dominantno nad endurance-supported oznakom. | Jasna odluka o samom učešću i prikaz kalendara baznog rada; ciljnull nije potvrda spremnosti. |
| R05 | Tehnički / prikaz | U02 rebuilt aktivacija PRED gubi `nemeri:true`, ali RP zona i dalje isključuje merenje forme. | Centralizovati activation metadata i derivePred; regresija da oba markera ostanu koherentna. Nema dokaza prihvaćenog lažnog merenja. |
| R06 | Product | U06 quality gate je savet: Jan20 RP postoji bez budućeg dokaza; race-week shakeouts nemaju pojedinačnu effort napomenu. | Jasno pokazati neuslovljen/advisory statičan plan ili kontrolisati ulazak u kvalitet pri stvarnom nastavku; kvalifikovati sve easy dane. |
| R07 | Product / kalendar | U01 ponavljanje run/walk lestvice počinje u ostatku tekuće nedelje: na Nov4 prvi repeat-rung koristi samo preostalo trčanje, pa W5 već ide sledeći rung. | Jasno trajanje svakog koraka ili puna prva nedelja; precizan opis u preview-u. |
| R08 | Prikaz | U07 partial W7 focus kaže bez kvaliteta, dok sačuvani raniji dani te iste nedelje imaju kvalitet/strides; odnosi se na ostatak. | Dodati „preostali dani” u partial-week fokus. |
| R09 | Normalizacija / preview | U05 novo-B-plan „42→42” menja18 budućih dana; „42→40”19, razlika među njima samo race goal tekst. | Ne pripisivati sve normalizacije bržem cilju. Pregled mora pošteno objasniti promenu isporučenog plana. |
| R10 | Zaokruživanje politike | U08 base nedeljni41,3→44,7 km je8,23%, iako je nominalni target8%. | Navesti toleranciju/zaokruživanje ili finalni delivered-volume ceiling. Nije univerzalni fiziološki dokaz prevelikog rasta. |

**Nije pronađen gubitak protected istorije niti promena ostvarenih km/min u proverenim slučajevima.** To ne znači da nema drugih tehničkih/product slabosti. R03 je reprodukovana numerička neusaglašenost nove integracije; R05–R10 su konkretna preostala ograničenja. Granice iz app heuristika nisu medicinska potvrda niti univerzalni pragovi.

Iskusni maraton i dalje ima kratke weekday M segmente, velik W15 finish i dugo trčanje sedam dana pred trku; HM rehearsal + sutrašnji MLR može biti zahtevno. Treneri traže individualnu kalibraciju, ne mehaničko povećavanje ili uklanjanje doze. Različiti dobri javni programi nisu zahtev da generator kopira jednu tablicu.

## Tehničke provere — odvojeno od trenerskih ocena

Lokalno: **typecheck/lint/format pass;1.519 testova u146 fajlova pass;396 backend testova pass;build pass.** E2E TypeScript i lint novog spec-a prolaze. Deset nezavisnih korisničkih proba ponovljeno sa exit0; to uključuje zabeleženi R03 audit nalaz, ne tvrdi da su svi product invarianti rešeni. [validation/user-probes.json](validation/user-probes.json) i logovi čuvaju komande/izlaze/hash-eve.

**Završni [CI 38271301547](https://github.com/Zlotvor92/sub-19/actions/runs/38271301547), commit `47a753576f5d376b827cfff2e5b0a6f8ec58c555`: sve tri grupe poslova pass; 1.519 testova +77/77 E2E, bez retry-ja/flaky/skipped testova; svih deset zaključanih profila i novi preservation tok prolaze.** Backend396/396 i database posao prolaze. Detalji su u [validation/ci.json](validation/ci.json). Finalni evidence commit dodaje samo docs/probe fajlove; web/backend/workflow/config ostaju jednaki ovoj testiranoj verziji.

Prvi CI `38269078475` na `1ee6840`: strict/lint/format,1.519 testova/build/backend/database pass; E2E **76 pass / 1 fail**. Novi spec je pretpostavio drugi easy slot, ali4-day/q2 plan ima samo jedan. Spec ispravljen da stvarno pomeri manual easy na rest slot; nema slabljenja zaštitnih assertions.

Drugi CI `38269640038` na `c66c42b`: isti tehnički pass, E2E **76 pass / 1 fail**. Novi spec je već prošao manual/moved/measured/done apply/reload, ali je tražio raniji runnable dan koji ne postoji jer plan počinje na današnji datum. Treći spec koristi drugi future trening, označen završenim unapred posle primene, pa restore mora očuvati njegov body zbog done statusa, nezavisno od cutoff-a. Screenshot/JSON attachments su sačuvani. Produkcioni kod nije menjan ovim korekcijama.

Početni lokalni pad Vercel testa obrazložen je dodavanjem QA grane u no-deploy listu. Početna greška TypeScript-a novog integracionog testa rešena je tačnim obaveznim id tipom; collision u dodatom test fixture-u rešen validnom recipročnom zamenom. Ni stari generator snapshot-i ni postojeći očekivani behavior assertions nisu oslabljeni.

Artifact **11757163653** je preuzet i SHA256 nezavisno proveren: `94cfd7587fb7253df7c90bf9d05ce28923e09c91e8e70c53ddc4f8e5d3a78cf2`. HTML report potvrđuje 77 expected/0 unexpected/0 flaky/0 skipped; indexed je svih11 QA tokova i41 originalnih PNG. Šest reprezentativnih originalnih screenshot-a pregledano je vizuelno i sačuvano u `browser/` (U01/U09 initial, U06 return, U08 base preview, novi measured-conflict preview i restored actual7,1km/38:00). Before/after/restore JSON capture-i nezavisno potvrđuju body/PRED/QS/moves/actuals/lock stabilnost, pored E2E assertions. Retention cele CI arhive ističe10.01.2027; izabrani screenshot-i, JSON dokazi i trajni indeks su commitovani. [browser/index.json](browser/index.json) beleži tačan domet; nije potpuna vizuelna revizija svih nedelja/uređaja.

## Domet browser dokaza i metodologije

Deset stvarnih wizard/persist/reload/povratak/apply/log/restore tokova u izolovanim mobile Chromium kontekstima. Auth i backend su testni; plan/dnevnik nisu seedovani. U08 primarno potvrđuje odbijanje; izbor base/reload/restore je jasno dodatni tok. Novi spec proverava manual future alt4,2 km, efektivni datum, ostvareni tempo4:11 i lock, stvarnih6,2 km/34:00 pre primene i7,1 km/38:00 posle nje kroz restore/reload. To nije potvrda live servera, satova, realne fiziološke adaptacije ili iOS Safari-ja.

Svi treneri pokrenuti su nezavisno, početne ocene predali pre unblinding-a, bez drugih zaključaka. Posle limita nastavljeni su sa sačuvanim sopstvenim stanjem; nepromenjeni score/report hash-evi provereni. Svaki je zatim čitao samo mašinske event pakete i svoje početne zapise. Originalni profil sadrži oznaku vrste/datuma događaja, ali početni paket nije imao event izlaze. Metadata/instrukcije mogu otkriti razlike; savršeno slepilo se ne tvrdi.

Primarni stručni izvori i njihove tačne granice su u četiri početna `coaches/*-review.md`. Nema pristupa privatnom Runna generatoru niti direktnih Runna izlaza za iste profile. Ocene nisu ljudska trenerska sertifikacija ili kontrolisani sportski eksperiment.

## Dokazi i nastavak

- [PROTOCOL.md](PROTOCOL.md), [REPRODUCE.md](REPRODUCE.md): zaključano poređenje i komande.
- `raw/` i `blind/`:20 celih početnih planova; `users/`:10 nezavisnih pregleda, primarni/supplemental payload-i i probe.
- `coaches/`:80 početnih ocena sa1.296 week notes, četiri početna izveštaja i40 event pregleda.
- [coach-inputs/index.json](coach-inputs/index.json): tačni event bajtovi koje su treneri čitali, gzip-arhivirani sa compressed/uncompressed SHA256. Ponovljene korisničke probe mogu osvežiti reprodukcionu metadata; ova arhiva čuva stvarni reviewerski ulaz.
- [evidence-check.json](evidence-check.json): integritet/obim,309 produkcionih fajlova i94 originalna QA fajla; [score-lock.json](score-lock.json): početni hash-evi; [event-review-summary.json](event-review-summary.json):40 presuda.
- [validation/ci.json](validation/ci.json) i browser indeks: stvarni CI identitet, test rezultati, artifact i vizuelno pregledani primeri.

Sledeći prozor treba da krene sa ovom QA granom/draft PR-om, prvo zatvori R03 završni delivered envelope i R05 activation metadata, zatim razreši odluku za limited initial/return maraton i bazni race row. Posle funkcionalnih promena napraviti zasebne nove izlaze i ponoviti relevantne blokirajuće primere. Sačuvati ovaj pregled kao istorijski dokaz. **Bez automatskog merge-a/deploy-a.**

## Naknadno odobrenje merge-a

Korisnik je nakon završnog QA izričito zatražio push i merge na main. Ta instrukcija zamenjuje početni zahtev da PR ostane draft. Produkcioni generator ostaje isti ocenjeni B; automatski Vercel deployment main grane je isključen da se očuva zasebno ograničenje bez deploy-a. Prilikom merge-a ne proglašavaju se zatvorenim otvoreni nalazi R01–R10.
