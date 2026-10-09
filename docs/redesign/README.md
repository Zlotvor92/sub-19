> **ISTORIJA. Ovaj dokument opisuje PRETHODNI pravac („Komandni centar“, font Archivo, boje faza). Zamenjen je pravcem „Quiet Athlete“: v. [QUIET_ATHLETE.md](QUIET_ATHLETE.md).** Sve ispod je zapis tadašnjeg stanja i ne važi za trenutni kod: tabovi Oporavak i Trka (sada ekrani u Napredak), zupčanik i Podešavanja (sada tab Ti), trajna traka ciklusa u zaglavlju i izgled samo u tamnoj temi više ne postoje.

# SUB-20 — UI/UX redizajn (pravac: „Komandni centar")

Stanje: **commit-ovano i pushovano** (`9fdca98`, 2026-10-02, prisutno u `origin/main`), a zatim zamenjeno pravcem Quiet Athlete. Domen (`web/src/domain`), store-ovi (`web/src/stores`) i servisi (`web/src/services`) nisu menjani u tom commit-u (`git show --stat 9fdca98 -- web/src/domain web/src/stores web/src/services` ne daje nijedan fajl).

## Kako je izabran pravac

- `docs/redesign/concept-lab.html` (isti sadržaj kao artifact „SUB-20 Concept Lab") — audit, 10 stvarno različitih koncepata na **stvarnim podacima iz generatora plana** (VDOT 49,2 → 5K 20:13, cilj 19:59), prekidač ekrana (Danas / trening / plan / napredak), matrica ocena i osetljivost na težine.
- Pobednik je **08 Komandni centar**. Iskreno: pobednik nije robustan — pri svih pet probanih težina 08 je **jedini koncept koji je uvek u prva tri**, ali ne uvek prvi. Odluka je zato donesena i po upotrebljivosti na telefonu i po tome što je jedini pravac koji drži fazu ciklusa stalno na ekranu.
- Ponovno građenje laboratorije: `node docs/redesign/lab/build.mjs`.

## Šta je novo (sistem, ne kozmetika)

| Oblast | Odluka |
| --- | --- |
| Ljuska | Trajna **traka ciklusa** u zaglavlju: 12 segmenata po fazi (BAZA·RAZVOJ·VRHUNAC·TAPER·TRKA), tekuća nedelja uzdignuta, rasterećenje niže, zastavica trke. Jedno dugme sa rečenicom za čitač ekrana, vodi na Plan. Tabovi: dole na telefonu, levo (96 px) ≥ 1024 px. |
| Tokeni | `styles/tokens.css`: površine po svetlini (bez stakla/gradijenata/senki), tekst/stanja/faze/poreklo podatka, razmak 4 px, radijusi 4/8/16, kretanje 120/200/320/480 ms. Font Archivo, **self-hosted** (CSP: `default-src 'self'`). |
| Poreklo podatka | **IZMERENO** (puna, bela) · **PROCENA** (plava, uokvirena) · **PROJEKCIJA** (isprekidana). Razlikuje se rečju, oblikom i bojom; isto na grafikonima. |
| Boja | Boja faze postoji samo uz oznaku faze/traku ciklusa i uvek uz tekst. Akcija je neutralno svetla; nijedna faza ne liči na dugme. |
| Danas | Jedan dominantni panel („Fartlek 4:00/km") sa trakom u boji faze; ostalo je sporedno (Završeno/Sledeće, Ciklus). |
| Plan | Mapa ciklusa: faze → nedelje → 7 ćelija dana (vrsta u 3 nivoa + stanje); grafikon nedelja sa pojasom faza; ≥ 1024 px pregled levo, mapa desno. |
| Trening | List: ciljni tempo kao hero + PROCENA, PRE/RAD/POSLE, profil (visina = brzina, širina = vreme), parametri, „Zašto ovaj trening". |
| Napredak (tab „Trka") | „Da li napredujem?" → odgovor (Da/Ne/Za sada isto/Još nema merenja), osa start → sada → cilj → plan; zatim dokazi razdvojeni po poreklu. |
| Oporavak | „Stanje danas": odlučuje **najlošiji postojeći signal** (bol, ACWR, HRV, puls u miru, san, svežina) — bez izmišljenog skora, bez novih pragova. Svaki signal ima brojku, stanje rečima i značenje; savet samo gde ga aplikacija već ima. |

## Provera (izmereno u ovoj sesiji)

- `npm run check` (tsc + eslint + prettier + vitest): **prolazi, 1114 testova** (baza 1079; dodato: journey, readiness, cycle/dayCells, sessionModel, Badge/CycleRail/Disclosure/Num).
- Playwright e2e: **39/39** (baza 33 + 6 novih u `e2e/redesign.spec.ts`: h1 po ekranu bez preskakanja nivoa, bez horizontalnog skrola na 390/768/1024/1440, mete dodira ≥ 44 px, `prefers-reduced-motion`, tabbar → rail, traka ciklusa).
- Kontrast (izračunat): tekst 14,9:1, tekst-2 9,5:1, tekst-3 6,1:1 na panelu; sve faze ≥ 6,2:1.
- Mete dodira na telefonu (390 px): sva dugmad/linkovi/summary ≥ 44 px (izuzeci niže).
- Fokus: vidljiv prsten 2 px, proveren Tab-om na Danas (zaglavlje, traka ciklusa, `summary`, dugmad, tabovi); ostali ekrani nisu prolaženi Tab-om jedan po jedan. `prefers-reduced-motion`: izračunato trajanje animacija i prelaza 0,01 ms.
- Veličina (gzip, ista mašina, `vite build`, HEAD vs. radno stablo): glavni JS 204,6 → 206,0 KB; svi JS ukupno ≈ 244,8 → 255,3 KB (+10,5 KB, +4,3 %); CSS 9,8 → 13,4 KB (sirovo 46,5 → 66,0 KB); novi fontovi 19,9 KB (woff2). Nema biblioteke za animacije — sve je CSS, osim brojeva (`Num`, ~50 linija).

## Popravke nađene tokom provere (stvarni nedostaci, ne kozmetika)

- Stubovi grafikona nedelja su kasnili do `25 ms × (nedelja − 1)`; kod plana od 18+ nedelja animacija je trajala duže od `ENTERING_MS` (900 ms) pa bi klasa `uskoci` pala usred crtanja. Kašnjenje je ograničeno na 12 koraka (300 ms); test sada proverava trajanje svih animacija ulaska naspram tajmera.
- Naslovi: tab Plan je skakao sa h1 na h3 — popravljeno (h2 sa izgledom oznake).
- Grafikon „Prosečan tempo" spajao je lagana i brza trčanja u cik-cak liniju bez poruke — sada su tačke bez linije, uz napomenu da se različite vrste treninga ne porede.
- Polja obrasca bila su ~25 px visoka meta; cela kutija je sada meta (oznaka se razvlači preko nje).

## Poznata ograničenja (nije urađeno / ne znam)

- **Nema svetle teme**; ikone za pokretanje (launcher) nisu menjane.
- **Nema smernica po pulsu (HR zone) na treningu**: plan ne nosi puls po sesiji, pa se ništa ne prikazuje (ne izmišljam zone).
- **Trajanje treninga je procena** zbira segmenata (označeno „Procena"); `null` kad nema osnove (nepoznat lagan tempo).
- Tekst `PHASE_LINE` (jedna rečenica po fazi) i `sessionGuide` kopija treba da prođu pregled vlasnika.
- Settings, Zajednica, Čarobnjak i kapija za prijavu su samo **ponovo obojeni** (tokeni), ne prelomljeni; `styles/legacy.css` (413 linija) je njihov.
- `window.alert/confirm` tokovi (npr. „Prilagodi tempo") su nepromenjeni — Toast bi menjao ponašanje koje testovi i e2e zaključavaju.
- Delovi mape tela su manji od 44 px (anatomija); isti unos je dostupan preko liste „Deo tela" u listu „Novi unos".
- Grafikoni se crtaju u fiksnom koordinatnom sistemu od 340 jedinica (u domenu: `domain/race/view.ts`, `domain/recovery/charts.ts`, nisu menjani); zato je širina ograničena na 480 px, a tekst na telefonu je ≈ 10 px.
- „Procena po distancama" koristi VDOT ekvivalente (uz upozorenje da važe za one koji treniraju baš za tu distancu). „Plan vodi do" je `meta.predictedSec` generatora.
- Stanje oporavka ne uključuje jutarnji zapis stariji od jednog dana (prikazan je kao „Star zapis").

## Naknadne izmene

- **Ikona aplikacije „2○"** (cifra 2 + prsten štoperice) i **ikone tabova** (štoperica, stubovi, prsten sa pulsom, zastavica) — izvor i generator: `docs/brand/build-icons.mjs`. APK u `web/public/sub20.apk` nije ponovo pravljen, pa ima staru ikonu dok se ne izgradi novi.
- **Zajednica je ugašena** iza jednog prekidača (`COMMUNITY_ENABLED` u `web/src/services/config.ts`): nema taba ni podešavanja, nema poziva ka tabeli; kod, domen, store i servis su na mestu. Ko je ranije bio vidljiv, pri pokretanju mu se javni red povlači.
- **Reel za Instagram:** `docs/reel/` (v. `objava.md`).

