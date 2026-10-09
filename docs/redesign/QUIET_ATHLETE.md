# Quiet Athlete — organizacija i vizuelni sistem

Stanje na dan 2026-10-09. Grana `claude/quiet-athlete`, osnova `d40c2b6` (poslednji commit pre redizajna). Zamenjuje pravac „Komandni centar“ ([README.md](README.md) je sada istorija).

Commit-ovi od osnove: `6e80e27` tokeni, tipografija, tema, ikone · `aa4c435` četiri taba i novi ekrani · `e8c3f4b` testovi · `c0720bd` e2e · `7b5e707` fokus pri otvaranju ekrana, putevi u porukama.

Pravilo dokumenta: sve što je ovde navedeno proveravano je čitanjem koda ili pokretanjem komande. Šta nije proveren, piše „nije proveren“. Nijedan broj nije procena.

---

## 1. Cilj i princip

**Zaključak.** Aplikacija ima četiri taba: Danas, Plan, Napredak, Ti. Sve ostalo je ekran koji se otvara iznad taba (dugme „Nazad“) ili mali list odozdo. Svaka funkcija ima jedno mesto. Izgled je miran: svetla i tamna tema, jedan veliki broj po ključnom podatku, tanke linije, otvorene sekcije umesto kartica. Domen, auth, baza, API i sinhronizacija nisu menjani (jedina razlika u tim oblastima: tekst dve poruke, v. tabelu ispod).

**Stanje pre** (iz koda u `d40c2b6`; nije utvrđeno ispitivanjem korisnika):

- Podešavanja su bila modalni list pod zupčanikom: 5 grupa i 11 sekcija (`SETTINGS_GROUPS` u `web/src/domain/settings/index.ts`), među njima Zajednica, ugašena prekidačem.
- Isti trening je imao dve verzije istog sadržaja: kartice na Danas i list dana (`DaySheet`), otvaran iz Plana i sa Danas.
- Napredak je bio razbijen na dva taba (Oporavak, Trka). Komentari u kodu beleže ponavljanje: forma je bila „pet kartica sa istim brojem u svakoj“, a HRV, san, svežina i puls u miru su bili ponovljeni u više kartica.
- Samo tamna tema. Pet nijansi faza različitih boja (plava, cijan, ćilibar, ljubičasta, crvena), trajna traka ciklusa u zaglavlju, font Archivo.

**Odluke:**

1. Četiri taba. Svaki odgovara na jedno pitanje: Danas — šta radim danas; Plan — šta je ove nedelje i kako menjam plan; Napredak — da li se rad sabira; Ti — ko sam, koji je cilj, šta je povezano.
2. Ekrani iznad taba za sve što je veće od jedne radnje; mali listovi odozdo samo za kratke izmene (v. odeljak 3).
3. Jedan ekran „Detalji treninga“ za sve o jednom danu. Zamenjuje list dana i stare kartice na Danas.
4. Podešavanja se ukidaju kao zaseban modal. Iste mogućnosti žive u tabu Ti, jedan red po temi.
5. Svetla i tamna tema, izbor po uređaju (odeljak 5).
6. Jedna boja marke (tamnozelena). Stanja (upozorenje, greška) samo uz reč ili ikonu.
7. UI Zajednice se briše (odobreno; zapis: poruka commit-a `aa4c435`).

**Nije dirano.** Provera (nula razlika osim tri navedena fajla):

```
git diff --stat d40c2b6 HEAD -- api supabase vercel.json test scripts web/src/domain web/src/services web/src/stores web/src/data
```

| Oblast                                                                    | Razlika od osnove                                                                                  |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `api/`, `supabase/` (baza, migracije), `vercel.json`, `test/`, `scripts/` | nema                                                                                               |
| `web/src/domain/` (generator plana, računice, sinhronizacija)             | samo `shell/swipe.oracle.test.ts` — test koji je tvrdio pet tabova, sada četiri                    |
| `web/src/stores/`                                                         | samo `uiStore.ts`: efemerno stanje ekrana (tab, stek ekrana, list), ne perzistira se               |
| `web/src/services/`                                                       | samo `oauth.ts`: tekst poruke `STRAVA_REJECTED_MESSAGE` („…iz Ti → Povezani servisi“)              |
| `web/src/app/createApp.ts`                                                | jedna poruka za odbijenu prijavu („…odjavi (Ti → Moj profil)…“)                                    |
| Oblik sačuvanog stanja                                                    | `SCHEMA_VERSION` ostaje 11 (`web/src/domain/state/types.ts`); izbor teme nije u stanju (odeljak 5) |

Posledica: domenski tekstovi su zamrznuti oracle testovima, pa neki i dalje pominju stare puteve; v. odeljak 10.

---

## 2. Organizacija

### 2.1 Četiri taba

| Tab      | h1                            | Koren sadrži                                                                                                                                                                                | Ekrani iznad (`kind`)                                                                                                                      |
| -------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Danas    | „Danas“ (vidi se samo čitaču) | trening dana sa jednim glavnim dugmetom „Detalji treninga“, tihe radnje „Završi trening“ / „Preskoči“, „Ove nedelje“ (km, traka), red „Sledeće trčanje“, obaveštenja samo kad su relevantna | `trening`, `plan-prilagodi` i `oporavak` (iz obaveštenja)                                                                                  |
| Plan     | „Tvoj plan“                   | jedna nedelja sa ‹ ›, 7 redova dana sa stanjem, redovi „Pomeri treninge“, „Prilagodi plan“, „Pošalji na sat“ (samo uz intervals.icu), dugme „Pregled celog plana“                           | `trening`, `plan-pregled` (h1 „Cela priprema“), `plan-prilagodi`, `sat`, `cilj` (iz Prilagodi plan)                                        |
| Napredak | „Napredak“                    | km poslednje 4 nedelje, VDOT i procena, poslednja aktivnost, rekordi, redovi ka detaljima                                                                                                   | `forma`, `oporavak`, `bol`, `masa`, `analiza-trke`, `aktivnosti`, `trening`                                                                |
| Ti       | „Ti“                          | profil, blok „Trenutni cilj“, sedam redova i, samo vlasniku, osmi red „Vlasnik“                                                                                                             | `profil`, `cilj`, `postavke-treninga`, `servisi`, `strava`, `icu`, `sat`, `obavestenja`, `izgled`, `privatnost`, `o-aplikaciji`, `vlasnik` |

Izvor: `web/src/features/registry.tsx` (tabovi), `web/src/features/screens.tsx` (ekrani), `web/src/features/sheets.tsx` (listovi).

Obaveštenja na Danas (`web/src/features/today/Advisories.tsx`) postoje samo kad važe: tuđ plan sa unosima („Ovo nije tvoj plan“), predlog prilagođavanja plana zbog bola, upozorenje oporavka (ton žut ili crven), predlog tempa prema formi, istekao backup. Kad ničega nema, ne prikazuje se ništa.

### 2.2 Stara funkcija → novo mesto

Statusi: **premešteno** (isti sadržaj, drugo mesto) · **spojeno** (više starih mesta u jedno, ili skraćeno) · **uklonjeno** (v. odeljak 8: 8a uz odobrenje, 8b odobrenje nije proveren) · **nepromenjeno**.

Osnova za „staro“: kod u `d40c2b6`. „Podešavanja“ = modalni list pod zupčanikom.

#### Ljuska

| Staro                                                          | Novo                                                                                     | Status        |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------- |
| Trajno zaglavlje sa natpisom ciklusa („N6/12 · RAZVOJ · 46 d“) | Plan: „Nedelja X od Y“, oznaka faze u gornjem redu, „za N dana“ uz trku u podnaslovu     | spojeno       |
| Trajna traka ciklusa (dugme koje vodi na Plan)                 | Plan → Pregled celog plana → „Cela priprema“: traka ciklusa kao slika sa celom rečenicom | premešteno    |
| Zupčanik → Podešavanja                                         | tab Ti (tabela F)                                                                        | uklonjeno, 8a |
| Animacija ulaska ekrana                                        | —                                                                                        | uklonjeno, 8a |
| Tabovi Danas · Plan · Oporavak · Trka (Zajednica ugašena)      | Danas · Plan · Napredak · Ti                                                             | spojeno       |

#### A. Tab Danas

| Staro                                                                                              | Novo                                                                                                                          | Status                        |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Traka „Ovo nije tvoj plan“ + „Napravi svoj“                                                        | Danas → obaveštenje, ista radnja                                                                                              | premešteno                    |
| Traka „Uradi backup podataka“ (Izvezi / Kasnije)                                                   | Danas → obaveštenje, iste dve radnje                                                                                          | premešteno                    |
| Traka „Novo: Zajednica“                                                                            | —                                                                                                                             | uklonjeno, 8a (sa Zajednicom) |
| Zaglavlje „Danas“ + datum                                                                          | gornji red sa datumom, h1 samo za čitač ekrana                                                                                | spojeno                       |
| Stanje „Plan još nije počeo / Plan je završen“                                                     | isto, plus dugme „Otvori plan“                                                                                                | nepromenjeno (dodato dugme)   |
| Dan odmora: kartica „Odmor“ + opis + „Sledeći trening“                                             | „Odmor“ + opis + „Detalji dana“; sledeći trening je red „Sledeće trčanje“                                                     | spojeno                       |
| Kartica treninga: naziv, ciljni tempo (+ „Tvoj cilj“ / „Procena“), distanca, trajanje, napor (RPE) | Danas: veliki broj (km, a bez njega minuti), naziv, jedan red tempo/napor + trajanje; sve ostalo u Detalji treninga → ciljevi | spojeno                       |
| Profil sesije (grafik) i „Struktura“                                                               | Detalji treninga → „Struktura“                                                                                                | premešteno                    |
| „Zašto ovaj trening“                                                                               | Detalji treninga → „Zašto ovaj trening“                                                                                       | premešteno                    |
| „Završi trening“, „Preskoči“, „Ipak sam odradio“, „Vrati“                                          | Danas, isto (tihe radnje); Detalji treninga → „Status“ (Predstoji / Odrađen / Preskočen)                                      | nepromenjeno                  |
| Linija „Odrađeno · km · vreme · tempo“                                                             | Danas, ista linija                                                                                                            | nepromenjeno                  |
| Kartica „Vreme“                                                                                    | Danas: jedan red u bloku treninga dok trening predstoji; Detalji treninga → „Vreme“                                           | spojeno                       |
| Kartica „Uneto“ (forma unosa)                                                                      | Detalji treninga → „Unos“ (km, vreme, puls, „Više detalja“: RPE, bol, masa, datum, beleška; radni deo — ostvaren tempo)       | premešteno                    |
| „Analiza treninga“: „Sa sata“, „Po zonama“, „Jutros“, poređenje sa ranijim, AI analiza             | Detalji treninga, isti redosled, tek kad je trening odrađen                                                                   | premešteno                    |
| „Završeno · N“ (lista dana sa km)                                                                  | Danas → „Ove nedelje“: zbir km i traka; lista dana nestaje (8b)                                                               | spojeno                       |
| „Sledeće“ (do 3 treninga)                                                                          | Danas → „Sledeće trčanje“: jedan red (8b)                                                                                     | spojeno                       |
| „Ciklus“: dana do trke                                                                             | Plan → podnaslov „za N dana“                                                                                                  | premešteno                    |
| „Ciklus“: serija bez propusta                                                                      | —                                                                                                                             | uklonjeno, 8b                 |
| „Ciklus“: faze sa kilometrima                                                                      | Plan → Pregled celog plana → faze                                                                                             | premešteno                    |
| Kvačica potvrde završetka                                                                          | Danas, ista kvačica (bez kruga)                                                                                               | nepromenjeno                  |

#### B. Tab Plan

| Staro                                                                     | Novo                                                                                                                                                       | Status                   |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| „Na šta da paziš u ovom planu“ (upozorenja generatora)                    | Plan → rasklopivi odeljak ispod nedelje                                                                                                                    | premešteno               |
| „Gde sam u planu“: % od plana do sada, % celog plana, traka               | Pregled celog plana → „Gde sam u planu“                                                                                                                    | premešteno               |
| „Gde sam u planu“: km nedeljno (prosek), najjača nedelja, ostalo, trčanja | najjača nedelja i trčanja po planu → Napredak → „Rekordi“; prosek i „ostalo“ nestaju (8b)                                                                  | spojeno                  |
| „Nedeljna kilometraža“ (grafik)                                           | Pregled celog plana → „Nedeljna kilometraža“                                                                                                               | premešteno               |
| Faze → nedelje sa 7 ćelija dana                                           | Pregled celog plana, isto                                                                                                                                  | premešteno               |
| Nedelje rasklopljene u listu dana                                         | Plan: uvek je prikazana jedna nedelja (tekuća; pre početka plana prva, posle kraja poslednja), ‹ › pomeraju; Pregled celog plana: isto rasklapanje kao pre | spojeno                  |
| „Pomeri treninge“ (zamena dana, „Vrati raspored nedelje na plan“)         | Plan → red „Pomeri treninge“; Pregled celog plana → nedelja; Detalji treninga → „Pomeri na drugi dan“                                                      | premešteno               |
| List dana (`DaySheet`)                                                    | ekran Detalji treninga                                                                                                                                     | premešteno               |
| List dana: „Izmeni trening“                                               | Detalji treninga → „Prilagodi trening“ → „Zameni ili skrati“ (list se i dalje zove „Izmeni trening“); odmor: „Dodaj trening“                               | premešteno               |
| List „Izmeni trening“: dugme „Vrati na plan“                              | ostaje u listu; dodat je i red „Vrati na plan“ u Detalji treninga → „Prilagodi trening“                                                                    | nepromenjeno (dodat red) |
| List dana: „Obriši unos“                                                  | Detalji treninga → „Obriši unos“                                                                                                                           | nepromenjeno             |
| Dan testa: napomena „Trka → Test 3 km“                                    | Detalji treninga → „Rezultat testa“ → „Unesi test na 3 km“                                                                                                 | premešteno               |
| Legenda ćelija                                                            | Pregled celog plana                                                                                                                                        | premešteno               |
| Držanje dugmeta tipa treninga da se doda snaga                            | dugme „Dodaj snagu uz trčanje“ u listu „Izmeni trening“                                                                                                    | spojeno                  |

#### C. Tab Oporavak

| Staro                                                       | Novo                                                                                   | Status     |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------- |
| „Stanje danas“ (odluka, razlog, signali)                    | Napredak → Oporavak                                                                    | premešteno |
| „Plan se može prilagoditi“ (predlog zbog bola)              | Plan → Prilagodi plan → „Zbog bola“; red na Danas                                      | premešteno |
| „Opterećenje“ (akutno/hronično)                             | Napredak → Oporavak → „Opterećenje“                                                    | premešteno |
| „Jutros“: HRV, san, svežina kao brojke                      | Oporavak → „Stanje danas“ (jedino mesto sa brojkama)                                   | spojeno    |
| „Jutros“: grafik HRV                                        | Oporavak → „HRV“                                                                       | premešteno |
| „Puls u miru“ (broj + grafik)                               | broj u „Stanje danas“, grafik i osnova u Oporavak → „Puls u miru“                      | spojeno    |
| „Bol“: mapa tela (Prednja/Zadnja), nivoi, „Dodaj unos bola“ | Napredak → Bol                                                                         | premešteno |
| „Bol“: „Poslednjih 14 dana“ i „Istorija bola“               | Bol → „Istorija“ (jedna lista; stariji od 14 dana prigušeni); broj delova u podnaslovu | spojeno    |
| „Bol“: „Kroz vreme“ (grafik)                                | Bol → „Kroz vreme“                                                                     | premešteno |
| „Telesna masa“                                              | Napredak → Telesna masa                                                                | premešteno |

#### D. Tab Trka (naslov ekrana je bio „Napredak“)

| Staro                                                                                     | Novo                                                                                                                                   | Status        |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Analiza trke (obrazac na vrhu ekrana)                                                     | Napredak → Analiza trke (ekran)                                                                                                        | premešteno    |
| „Da li napredujem?“ + put start → sada → cilj                                             | Napredak → Forma i predikcija                                                                                                          | premešteno    |
| Predlog „Prilagodi tempo“, „Tempi su prilagođeni…“, „Vrati planski tempo“                 | Plan → Prilagodi plan; red na Danas                                                                                                    | premešteno    |
| „VDOT kroz vreme“ + AI tumačenje trenda                                                   | Forma i predikcija → „VDOT kroz vreme“, „Tumačenje“                                                                                    | premešteno    |
| „Predikcija kroz plan“                                                                    | Forma i predikcija                                                                                                                     | premešteno    |
| „Procena po distancama“                                                                   | Forma i predikcija                                                                                                                     | premešteno    |
| „Test 3 km“ (unos, izmena, raniji testovi)                                                | Forma i predikcija → „Test 3 km“ (list `t3k`)                                                                                          | premešteno    |
| „Tempo svakog trčanja“ (grafik)                                                           | —                                                                                                                                      | uklonjeno, 8b |
| „Poslednja trčanja“ (4, bez otvaranja)                                                    | Napredak → „Poslednja aktivnost“ (otvara Detalje) + „Sve aktivnosti“                                                                   | spojeno       |
| „Do sada“: % plana, najjača nedelja, najduže trčanje, najbrži test 3 km, trčanja po planu | Napredak → „Rekordi“ (do četiri stavke, prikazuju se one za koje ima podataka) + km poslednje 4 nedelje; % plana → Pregled celog plana | spojeno       |
| „Do sada“: km nedeljno (prosek)                                                           | —                                                                                                                                      | uklonjeno, 8b |
| Veza „Cela mapa ciklusa“                                                                  | Plan → „Pregled celog plana“                                                                                                           | premešteno    |

#### E. Tab Zajednica

Sve uklonjeno, 8a: rang-lista, filter po ciljnoj distanci, izbor mere rangiranja, „Ove nedelje“, profil učesnika („Poslednja trčanja“, „Značke“), poređenje („Duel“, „U odnosu na tebe“), „Izazov nedelje“.

#### F. Podešavanja → tab Ti

| Staro (grupa → sekcija)                                                                                                                                      | Novo                                                                                                           | Status        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------- |
| Naslov + brojač podataka („N treninga · … zapisa o bolu · …“)                                                                                                | Ti → O aplikaciji → „Na uređaju“                                                                               | premešteno    |
| Upozorenje „Skladište nedostupno“                                                                                                                            | Ti → O aplikaciji (tekst upozorenja, bez trake)                                                                | premešteno    |
| Vrh Podešavanja („Dve stvari čekaju“ / „Sve je povezano“): zbirni status nalog / Strava / intervals.icu / sat / backup + jedno dugme za prvu stvar koja čeka | statusi u redovima (Ti: „Nisi prijavljen“; Povezani servisi: tačke i sažetak); backup na Danas                 | uklonjeno, 8b |
| Grupe Nalog / Trening / Veze / App / Admin                                                                                                                   | spisak redova u Ti                                                                                             | uklonjeno, 8b |
| Nalog: „Prijavi se Google nalogom“, „Sinhronizuj“, „Odjavi se“, „Obriši nalog“, objašnjenja                                                                  | Ti → Moj profil → „Nalog“; „Obriši nalog“ i u Privatnost i podaci                                              | premešteno    |
| Podaci: „Ranije verzije“, „Izvezi backup“, „Uvezi backup“, „Prijavi problem“                                                                                 | Ti → Privatnost i podaci                                                                                       | premešteno    |
| Plan: „Ciljno vreme“ / „Promeni cilj“                                                                                                                        | Ti → Cilj (blok „Trenutni cilj“ na Ti); Plan → Prilagodi plan → „Promeni ciljno vreme“                         | premešteno    |
| Plan: „Preračunaj plan prema formi“                                                                                                                          | Plan → Prilagodi plan                                                                                          | premešteno    |
| Plan: „Napravi novi plan“ / „Generiši novi plan“ / „Vrati na moj plan“                                                                                       | Plan → Prilagodi plan; Ti → Cilj (bez generisanog plana: „Generiši novi plan“); Danas („Napravi svoj“)         | premešteno    |
| Vreme: lokacija uključi / isključi, osvežavanje, „U koliko sati obično trčiš“                                                                                | Ti → Zone i postavke treninga → „Vreme i lokacija“                                                             | premešteno    |
| Strava: „Poveži Stravu“, „Uvezi trčanja“, „Otkači“, „Šta se uvozi“, „Pravila uvoza“                                                                          | Ti → Povezani servisi → Strava                                                                                 | premešteno    |
| „Tvoje zone pulsa“ (uvučeno u sekciju Strava)                                                                                                                | Ti → Zone i postavke treninga → „Zone pulsa“                                                                   | premešteno    |
| intervals.icu: OAuth, ručno povezivanje (ID sportiste, API ključ), povlačenje, „Otkači“, pomoć                                                               | Ti → Povezani servisi → intervals.icu                                                                          | premešteno    |
| Slanje na sat: „Pošalji na sat (14 dana)“, „Vidi šta se šalje“, „Iz početka“                                                                                 | Ti → Povezani servisi → Slanje na sat; Plan i Prilagodi plan → „Pošalji na sat“ (kad je intervals.icu povezan) | premešteno    |
| Obaveštenja: uključi, probno, isključi                                                                                                                       | Ti → Obaveštenja                                                                                               | premešteno    |
| Zajednica: uključivanje, nadimak; izazov nedelje (vlasnik)                                                                                                   | —                                                                                                              | uklonjeno, 8a |
| Obaveštenje korisnicima, Korisnici (samo vlasnik)                                                                                                            | Ti → Vlasnik                                                                                                   | premešteno    |
| „Osveži aplikaciju“                                                                                                                                          | Ti → O aplikaciji → „Offline kopija“                                                                           | premešteno    |
| Verzija · šema · broj treninga i km · „Uputstvo“ · „Politika privatnosti“                                                                                    | Ti → O aplikaciji (verzija, šema, plan, „Pomoć“); Privatnost i podaci → „Politika privatnosti“                 | premešteno    |

#### G. Dodato (nije postojalo)

- Blok profila na Ti (inicijal, status naloga) i blok „Trenutni cilj“ sa velikim brojem.
- Ti → Moj profil → „Trkačko iskustvo“: ulaz čarobnjaka kao spisak, samo čitanje (`web/src/features/ti/profileModel.ts`). Polje koje ne postoji se preskače, ne izmišlja se.
- Ti → Cilj (ekran).
- Ti → Izgled aplikacije (tema).
- Napredak → Sve aktivnosti: istorija iz dnevnika (ručni unosi, Strava, intervals.icu), najnovije prvo, 30 po strani, „Prikaži starije“ (`PAGE = 30` u `ActivitiesScreen.tsx`).
- Napredak → km poslednje 4 nedelje (`recentWeeks`, `count = 4`) i „Poslednja aktivnost“.
- Plan: navigacija po nedeljama ‹ › i red dana sa stanjem: „završeno“, „preskočeno“, „nije odrađeno“, današnji istaknut.
- Istorija pregledača po slojevima (Back, odeljak 3) i fokus pri otvaranju ekrana.

#### H. Promene ponašanja koje nisu samo premeštanje

- Podešavanja su se zatvarala posle: odjave, uvoza backup-a, povezivanja i otkačivanja intervals.icu, uvoza i otkačivanja Strave, promene cilja, preračunavanja plana. Sada ekran ostaje otvoren (u kodu su uklonjeni pozivi `closeSheet()`); posle uvoza backup-a stoji „Backup je uvezen.“.
- Poruke domena koje pominju „Podešavanja → …“ prikazuju se sa novim putem (`web/src/lib/copy.ts`, odeljak 10).

### 2.3 Putanje za 7 zadataka novog korisnika

**Ovo je sopstvena provera (broj dodira u e2e testu), NIJE ispitivanje korisnika. Nijedan stvaran korisnik nije probao novu organizaciju.**

Izvor: `web/e2e/navigation.spec.ts`, blok „zadaci novog korisnika — broj dodira od početnog ekrana“. Pravilo brojanja: dodir = jedan tap; polazište je ekran Danas; tap na tab se računa. Gornju granicu drži test: ako put postane duži, test pada.

| #   | Zadatak                                      | Put                                          | Dodira | Šta test zaista izvodi i proverava                                                                                                                                                                                |
| --- | -------------------------------------------- | -------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Gde je današnji trening i njegovi detalji    | Detalji treninga                             | 1      | trening (`#tcard`) je vidljiv bez dodira; dodir otvara Detalje, vidi se dugme „Odrađen“                                                                                                                           |
| 2   | Promena datuma treninga                      | Detalji treninga → Pomeri na drugi dan → dan | 3      | izvodi 2 dodira; proverava da je otvorena zamena sa već izabranim danom („Izabrano: … dodirni dan sa kojim…“) i da ima redova. Treći dodir (ciljni dan) je u naslovu i komentaru testa, ne izvodi se u ovom testu |
| 3   | Sledeća nedelja                              | Plan → ‹ › („Sledeća nedelja“)               | 2      | pojavi se naslov „Nedelja 2 od N“                                                                                                                                                                                 |
| 4   | Prethodna aktivnost                          | Napredak → Sve aktivnosti                    | 2      | otvara se „Sve aktivnosti“ sa bar jednim redom. Priprema (nije u broju): „Završi trening“ na Danas                                                                                                                |
| 5   | Analiza trke                                 | Napredak → Analiza trke                      | 2      | otvara se ekran „Analiza trke“                                                                                                                                                                                    |
| 6   | Povezivanje servisa i provera sinhronizacije | Ti → Povezani servisi → Strava               | 3      | red Strava kaže „nije povezano“; na ekranu Strava vidi se „Poveži Stravu“. Samo povezivanje (OAuth) nije u broju i ne izvodi se                                                                                   |
| 7   | Cilj i podešavanja plana                     | Ti → Trenutni cilj; Plan → Prilagodi plan    | 2 i 2  | ekran „Cilj“ sa poljem „Novo ciljno vreme“; ekran „Prilagodi plan“                                                                                                                                                |

Dodatno iz koda (nije u testu):

- Zadatak 4: poslednja aktivnost je već na tabu Napredak (1 dodir), otvaranje je drugi dodir; „Sve aktivnosti“ je potpuna lista.
- Zadatak 6, kad je Strava povezana: red u Povezanim servisima pokazuje „uvoz <datum>“ (2 dodira), ekran Strava „poslednji uvoz“ i „Uvezi trčanja“ (3 dodira).
- Zadatak 2 za drugi dan (ne današnji): Plan → „Pomeri treninge“ → dan A → dan B = 4 dodira.

Poređenje sa starim putem (čitanjem koda u `d40c2b6`, **nije izvršeno**; gde se ne može izvesti bez nagađanja, piše „nije proveren“):

| #   | Staro                                                                        | Novo                 |
| --- | ---------------------------------------------------------------------------- | -------------------- |
| 1   | 1 (isto)                                                                     | 1                    |
| 2   | 5: Plan → nedelja → „Pomeri treninge“ → dan A → dan B                        | 3                    |
| 3   | 2: Plan → red nedelje (sve nedelje su na jednom spisku)                      | 2                    |
| 4   | trka tab pokazuje poslednja 4 trčanja bez otvaranja; potpune liste nije bilo | 2                    |
| 5   | 1: obrazac Analiza trke je na vrhu taba Trka                                 | 2 (jedan dodir više) |
| 6   | nije proveren (zavisi od grupe koju list otvori)                             | 3                    |
| 7   | 3 pre polja: zupčanik → grupa „Trening“ → kartica „Plan“                     | 2                    |

---

## 3. Navigacija

**Slojevi** (od najnižeg):

| Sloj                | Stanje (`web/src/stores/uiStore.ts`)       | Otvara                                                                         | Zatvara                                    | Unos u istoriji |
| ------------------- | ------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------ | --------------- |
| Tab (koren)         | `tab`                                      | traka tabova                                                                   | —                                          | ne              |
| Ekran               | `screens` (stek)                           | `openScreen({ kind, props })`                                                  | „Nazad“, sistemski Back, promena taba      | da, po jedan    |
| List                | `sheet` (jedan)                            | `openSheet({ kind, props })`                                                   | Back, Escape, dodir na pozadinu, „Sačuvaj“ | da              |
| Potvrda             | `confirm`                                  | `confirmAction` (`ConfirmHost`, `alertdialog`)                                 | odgovor                                    | ne              |
| Sistemske trake     | `banners`                                  | sukob sinhronizacije, oštećen zapis, nova verzija, greška upisa (`BannerHost`) | radnja na traci                            | ne              |
| Čarobnjak / prijava | `wizard` (`uiStore`), `gate` (`authStore`) | bez plana je jedini ekran; kapija kad je potrebna prijava                      | —                                          | ne              |

**Tabovi.** `TABS = danas, plan, napredak, ti`. `setTab` briše stek ekrana. Koren otvorenog taba ostaje montiran, samo skriven (`hidden`), pa mu stanje preživi dok je ekran iznad. Zapamćen je samo tab (sessionStorage, `TAB_KEY`), ne i ekrani: posle ponovnog učitavanja vraća se koren taba.

**Ekrani.** Registar `SCREENS` u `web/src/features/screens.tsx` proverava `props` na granici; nepoznat `kind` ne otvara ništa (stari link ne sme da obori aplikaciju). Svaki ekran nosi `ScreenFrame` (dugme „Nazad“ + jedan h1). `openScreen` zatvara list ako je bio otvoren. Ekran istog tipa za drugi dan/trku dobija novi ključ, pa stanje starog ne preživi.

**Listovi** (`web/src/features/sheets.tsx`): `alt` (Izmeni trening), `swap` (Pomeranje treninga), `t3k` (test na 3 km), `knee` (unos bola), `history` (Ranije verzije), `bug` (Prijavi problem), `delete-account`, `users`. Na ≥ 768 px list postaje dijalog u sredini (širina do 560 px), na telefonu izlazi odozdo.

**Istorija i Back** (`web/src/app/navHistory.ts`). Pravilo: broj unosa u istoriji pregledača jednak je broju otvorenih slojeva (ekrani + list). Otvaranje sloja radi `pushState`; zatvaranje drugim putem (promena taba, „Sačuvaj“) vraća istoriju jednim `history.go(-n)`, a `popstate` koji to izazove prepoznaje se brojačem i ne zatvara ništa drugo. Pravi Back zatvara najviši sloj (list pre ekrana). Bez otvorenih slojeva Back izlazi iz aplikacije, kao ranije. „Nazad“ u aplikaciji (`navBack`) ide istim putem kao sistemski taster. Test: `web/src/app/navHistory.test.ts`; e2e „Back sistema zatvara ekran i list, ne izlazi iz aplikacije“.

**Aliasi i adrese** (`web/src/app/tabs.ts`, `web/src/app/App.tsx`):

| Adresa                                         | Efekat                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `?tab=danas`, `plan`, `napredak`, `ti`         | taj tab                                                                                                                                                                                                                                                                                                     |
| `?tab=opor`                                    | Napredak + ekran Oporavak                                                                                                                                                                                                                                                                                   |
| `?tab=pred`                                    | Napredak + ekran Forma i predikcija                                                                                                                                                                                                                                                                         |
| `?tab=` sa nepoznatom vrednošću (npr. `zajed`) | ignoriše se: tab zapamćen u sessionStorage, a bez njega Danas                                                                                                                                                                                                                                               |
| `?dan=<id>` (obaveštenje)                      | ID mora da odgovara `^[A-Za-z0-9_-]{1,64}$`; adresa se čisti odmah (`replaceState`), pa osvežavanje ne otvara ponovo; dan mora da postoji u planu, inače se ekran ne otvara; tab je Danas ako je to današnji dan, inače Plan; otvara Detalje treninga; ako dan ima posao analize u toku, odmah se proverava |
| prečice iz `manifest.json`                     | `./?tab=plan`, `./?tab=opor`, `./?tab=pred` (zato aliasi ostaju)                                                                                                                                                                                                                                            |

**Skrol i fokus** (`App.tsx`, `Shell.tsx`). Ekran se otvara od vrha; pri zatvaranju skrol se vraća na mesto sa kog je otvoren; promena taba uvek počinje od vrha. Otvoren ekran prebacuje fokus na svoj h1; „Nazad“ vraća fokus na red koji ga je otvorio (ako je još vidljiv). e2e: „fokus: ekran preuzima fokus na svom naslovu…“.

**Prevlačenje između tabova** (`web/src/app/useSwipeNav.ts`, odluke u `web/src/domain/shell/swipe.ts`). Radi samo na korenu taba: isključeno je dok je otvoren list, ekran, čarobnjak ili kapija. Dodir koji počne u polju za unos ili u elementu koji se sam pomera vodoravno pripada tom elementu. Konstante: prag 28 % širine ekrana (`SWIPE_FRACTION`) ili brzina ≥ 0,45 px/ms (`SWIPE_FLING_PX_MS`); vodoravno mora biti 1,3 puta duže od uspravnog; mrtva zona 10 px; kraj niza popušta najviše 70 px; dovršetak traje 240–560 ms. Pod „smanjeno kretanje“ nema pomeranja, samo promena taba.

**Traka tabova.** `nav#tabbar`, `aria-label="Glavna navigacija"`, tekući tab nosi `aria-current="page"`. Dole na telefonu (visina 62 px + `safe-area`), levo 96 px od 1024 px širine. Sadržaj je jedna kolona do 600 px (680 px od 768 px).

---

## 4. Vizuelni sistem

Izvor: `web/src/styles/tokens.css` (jedini izvor vrednosti), pa `base.css`, `ui.css`, `shell.css`, `screens.css`, `charts.css`, `wizard.css`. Komponente čitaju samo token. Izuzeci: uvodni ekran (`#uvod` u `base.css`, uvek tamnozelen `#335e35` sa `#f6f7f5`, u obe teme) i senka sistemske trake (`.traka` u `ui.css`).

### 4.1 Boje (svetla / tamna)

| Grupa           | Tokeni                                                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Površine        | `bg` #f6f7f5 / #0f1612 · `surface` #ffffff / #161f19 · `surface-2` #edf0eb / #1f2a23 · `surface-sel` #e6eee5 / #1e3024 · `line` #e0e5de / #26332b · `line-strong` #c5ccc2 / #394a3f · `border-ui` #848f87 / #6f7f74 |
| Tekst           | `text` #19251e / #e9f0ea · `text-2` #46554b / #b4c2b8 · `text-3` #5c6b61 / #93a398                                                                                                                                  |
| Akcija          | `accent` #335e35 / #8cc79a · `accent-ink` #ffffff / #0b160e · `accent-press` #284a2a / #a3d5af · `accent-text` #2b5230 / #8cc79a                                                                                    |
| Stanja          | `ok` #2b5230 / #8cc79a · `warn` #8a5600 / #e6b04a · `warn-soft` #f6ead2 / #2d2410 · `bad` #a3322a / #f0897d · `bad-soft` #f8e1de / #321a17 · `focus` #1f5fbf / #7db3ff                                              |
| Faze            | `ph-base` #7ca07f / #4f6b53 · `ph-build` #4f8056 / #6e9a75 · `ph-peak` #335e35 / #a4d3ac · `ph-taper` #838871 / #8e9580 · `ph-race` #19251e / #e9f0ea                                                               |
| Poreklo podatka | `measured` #19251e / #e9f0ea · `estimated` #335e35 / #8cc79a · `projected` #5c6b61 / #93a398                                                                                                                        |
| Vrsta treninga  | `k-easy` #78877c / #6f7f74 · `k-quality` #335e35 / #8cc79a · `k-long` #4f8056 / #5f8d68                                                                                                                             |

Pravila: akcija je tamnozelena (u tamnoj temi svetlozelena), to je jedina boja marke. Faze su tonovi jedne boje i prikazuju se uvek uz naziv faze (pre: pet različitih boja). Poreklo podatka razlikuje se oblikom oznake, pa se razlikuje i bez boje: izmereno = puni romb, procena = puni krug, projekcija = isprekidan krug (`.badge.prov-*` u `ui.css`). Skrim: `rgba(25,37,30,.42)` / `rgba(0,0,0,.6)`.

### 4.2 Tipografija

Figtree, self-hosted (`web/src/styles/fonts/figtree-latin.woff2`, `figtree-latin-ext.woff2`, licenca OFL u `OFL.txt`); CSP je `default-src 'self'`. Zamenjuje Archivo.

| Token                        | Veličina                                    | Upotreba                                                           |
| ---------------------------- | ------------------------------------------- | ------------------------------------------------------------------ |
| `--fs-label`, `--fs-caption` | 13 px                                       | oznake (verzal, razmak 0,08 em), napomene                          |
| `--fs-small`                 | 14 px                                       | sekundarni tekst                                                   |
| `--fs-body`                  | 16 px                                       | osnovni tekst                                                      |
| `--fs-lead`                  | 18 px                                       | uvodna rečenica                                                    |
| `--fs-h3`                    | 20 px                                       | h2 (naslov odeljka), `base.css` mapira h2 na ovaj token            |
| `--fs-h2`                    | 24 px                                       | naziv treninga na Danas, naslov lista, naslov poslednje aktivnosti |
| `--fs-h1`                    | `clamp(1.75rem, 7.4vw, 2.125rem)`, 28–34 px | h1                                                                 |
| `--fs-num`                   | 40 px                                       | broj u redu statistike                                             |
| `--fs-hero`                  | `clamp(4.5rem, 25vw, 6.5rem)`, 72–104 px    | veliki broj ekrana                                                 |

Težine u upotrebi: 300 (`--w-light`, samo za velike brojeve, ≥ 56 px), 400, 500, 600 (`--w-strong`), 700 (`--w-heavy`). Brojevi imaju `tabular-nums lining-nums`. Veliki broj po ključnom podatku: Danas (km), Plan (km nedelje), Napredak (km perioda), Ti i Cilj (ciljno vreme). Izuzetak od 13 px kao najmanjeg: tekst unutar SVG grafikona je zadat u jedinicama crteža (11,5; crtež je širok 340 jedinica), pa je na telefonu širine 390 px (grafik 350 px) ≈ 11,8 px. Ovo je poznato odstupanje.

### 4.3 Razmak, radijus, dodir, kretanje

| Šta                  | Vrednosti                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Razmak (osnova 4 px) | 4 · 8 · 12 · 16 · 24 · 32 · 48 px (`--s-1`…`--s-7`); bočni razmak sadržaja 20 px (28 px od 768 px)                                             |
| Radijus              | 6 px (oznake, ćelije) · 12 px (polja, istaknuti red) · 20 px (list, dijalog) · pilula (dugmad)                                                 |
| Dodir                | `--touch: 44px`; dugme 52 px (`.btn.sm` 44 px); red spiska ≥ 60 px; segment ≥ 44 px                                                            |
| Kretanje             | 120 · 200 · 320 · 480 ms (`--dur-1`…`--dur-4`; 480 samo za crtanje podataka); `ease-out` i `ease-in-out`; gasi se pod `prefers-reduced-motion` |

### 4.4 Komponente (`web/src/components/ui/`)

| Komponenta           | Uloga                                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `Section`            | odeljak: h2 + opcioni podatak desno; bez kartice, razdvaja ga razmak i linija                                              |
| `Row`                | red spiska: ikona, naslov, podnaslov, vrednost, strelica; dugme ili veza, ≥ 60 px                                          |
| `Notice`             | obaveštenje u toku sadržaja: jedna rečenica, do dve radnje; ton info / warn / bad; `bad` je `role="alert"`                 |
| `Facts`              | lista „oznaka — vrednost“ (`dl`)                                                                                           |
| `Bar`                | traka napretka (`role="img"` sa rečenicom); opciona „duh“ traka = koliko je do sada trebalo                                |
| `.seg`               | segmentirana kontrola (Status treninga, Prednja/Zadnja, Tema); `aria-pressed`                                              |
| `.chip`              | uključi/isključi izbor (npr. „Dodaj snagu uz trčanje“)                                                                     |
| `Badge`              | stanje (tačka + reč), poreklo podatka, faza (boja + naziv)                                                                 |
| `Disclosure`, `Help` | izvorni `<details>`; sadržaj nije u žiži dok se ne zatraži                                                                 |
| `Num`                | broj koji se približava vrednosti 320 ms; čitač dobija samo konačnu vrednost; pod „smanjeno kretanje“ odmah tačna vrednost |
| `Sheet`              | list (odeljak 7)                                                                                                           |
| `Shell`              | `AppBar`, `ScreenFrame`, `Tabbar`, `Page`, `AuthGate`                                                                      |

### 4.5 Ikone

Jedan skup linijskih ikona (`web/src/components/ui/icons.tsx`): 46 imena u `IconName`, raster 24 × 24, potez 1,8, okrugli krajevi, podrazumevano 20 px (u redu 24 px). Ikone tabova su 26 px; aktivan tab dobija popunjenije telo (potez 2,1), ne drugu boju. Nema emodžija ni unicode znakova umesto ikona u komponentama ekrana.

### 4.6 Šta namerno ne postoji (i izuzeci nađeni u kodu)

- Kartice: klasa `.card` ne postoji ni u CSS-u ni u TSX-u. Jedini okviri u obliku kartice su `.ob-card` u čarobnjaku (`wizard.css`).
- Gradijenti i senke za ukras: ne. Izuzeci: isprekidane linije u legendi grafikona (`repeating-linear-gradient`, `charts.css`), prsten oko tačke grafikona (`box-shadow: 0 0 0 Npx var(--bg)`), tačka izbora u čarobnjaku (`radial-gradient`, `wizard.css`), jedna prava senka na sistemskoj traci (`.traka`: `0 6px 24px rgba(0,0,0,.12)`).
- Staklo i zamućenje: ne (`backdrop-filter` ne postoji).
- Zaglavlje sa zupčanikom i trajna traka ciklusa: ne.
- Animacija ulaska ekrana: ne.
- Boja kao jedini nosilac značenja: ne. Stanja imaju reč ili ikonu, faze naziv, poreklo oblik.
- Emodžiji u komponentama: ne. Izuzeci: znak ✓ u kratkim statusima dugmadi (npr. „Poslato ✓“), ✕ u čarobnjaku, i zamrznuti domenski tekstovi koji sadrže 🏁 (opisi dana trke u `domain/training/generator`, `domain/plan/altEditor.ts`, `domain/plan/header.ts`, `data/personalPlan.ts`).
- Sirove boje u komponentama: ne, osim uvodnog ekrana (gore).

---

## 5. Tema

Tri izbora (Ti → Izgled aplikacije): „Prati sistem“ (podrazumevano), „Svetla“, „Tamna“. Kod: `web/src/lib/theme.ts`, `web/src/lib/useTheme.ts`, `web/public/tema.js`, ekran `AppearanceScreen` u `web/src/features/ti/screens.tsx`.

| Pitanje                               | Odgovor                                                                                                                                                                                                                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gde se čuva                           | `localStorage`, ključ `sub20-tema`, vrednost `light` ili `dark`; „Prati sistem“ briše ključ                                                                                                                                                                                                        |
| Kako se primenjuje                    | atribut `data-theme` na `<html>`; bez njega odlučuje `prefers-color-scheme` u CSS-u (`:root:not([data-theme='light'])` u media bloku)                                                                                                                                                              |
| Bez bljeska pogrešne boje             | `tema.js` je spoljna sinhrona skripta u `<head>`, izvršava se pre prvog iscrtavanja i postavlja `data-theme` (CSP `script-src 'self'` ne dozvoljava inline). Ubačena je u predkešovane fajlove (`web/scripts/sw-build.mjs`). e2e: „izbor teme se pamti po uređaju, preživljava ponovno učitavanje“ |
| Boja trake pregledača                 | dva taga `meta[name="theme-color"]` sa `media`; `applyTheme` ih usklađuje: pri „Prati sistem“ svaki nosi svoju boju, pri ručnom izboru oba istu. Boje: `#f6f7f5` (svetla), `#0f1612` (tamna), jednake tokenu `bg`                                                                                  |
| Isti rečnik u dve skripte             | `theme.test.ts` drži da `tema.js` i `theme.ts` ne odstupaju (ključ, vrednosti, boje)                                                                                                                                                                                                               |
| Zašto nije u sinhronizovanom stanju   | izbor je svojstvo uređaja (telefon tamno, laptop svetlo); oblik stanja (`SCHEMA_VERSION` 11) se zbog izgleda ne dira. e2e proverava da `sub20-tema` ne završi u podacima koji idu na server                                                                                                        |
| Zabranjeno skladište (privatni režim) | čitanje i upis su u `try/catch`; ostaje sistemska tema, a promena važi dok je stranica otvorena                                                                                                                                                                                                    |
| Šta ne prati temu                     | `manifest.json` ima fiksne `theme_color` `#f6f7f5` i `background_color` `#335e35` (manifest ne može da prati temu); uvodni ekran je uvek tamnozelen                                                                                                                                                |

---

## 6. Kontrast

Merilo: WCAG 2.x, odnos relativne luminanse. Prag 4,5:1 za tekst, 3:1 za ivicu kontrole i znake bez teksta. Računa skripta ispod (čita `web/src/styles/tokens.css`); sesijska kopija: `/tmp/claude-0/-home-user-sub-19/41fb01ed-a8d9-526c-a0eb-0ff1caeb2648/scratchpad/tools/contrast.py`. Skripta nije u repozitorijumu; njen tekst je na kraju odeljka. Ispod je njen stvarni izlaz (pokrenuta 2026-10-09).

**Tekstualni parovi**

| Par                                      | Svetla | Tamna |
| ---------------------------------------- | ------ | ----- |
| `text` na `bg`                           | 14,75  | 15,84 |
| `text` na `surface`                      | 15,85  | 14,56 |
| `text` na `surface-sel`                  | 13,38  | 12,05 |
| `text-2` na `bg`                         | 7,34   | 9,92  |
| `text-2` na `surface`                    | 7,89   | 9,12  |
| `text-3` na `bg`                         | 5,24   | 6,94  |
| `text-3` na `surface`                    | 5,63   | 6,38  |
| `text-3` na `surface-2`                  | 4,90   | 5,61  |
| `text-3` na `surface-sel`                | 4,75   | 5,28  |
| `accent-ink` na `accent` (tekst dugmeta) | 7,52   | 9,47  |
| `accent-text` na `bg`                    | 8,31   | 9,40  |
| `accent-text` na `surface-sel`           | 7,54   | 7,15  |
| `warn` na `bg`                           | 5,73   | 9,33  |
| `warn` na `warn-soft`                    | 5,16   | 7,78  |
| `bad` na `bg`                            | 6,41   | 7,50  |
| `bad` na `bad-soft`                      | 5,52   | 6,62  |

Svih 16 parova ≥ 4,5:1 u obe teme (skripta ispisuje „OK“ za sve).

**Parovi bez teksta (prag 3:1, osim gde piše drugačije)**

| Par                                                                                                                                            | Svetla | Tamna |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| `border-ui` na `bg` (ivica kontrole)                                                                                                           | 3,12   | 4,34  |
| `border-ui` na `surface`                                                                                                                       | 3,35   | 3,99  |
| `focus` na `bg` (prsten fokusa)                                                                                                                | 5,67   | 8,54  |
| `accent` na `bg`                                                                                                                               | 7,00   | 9,40  |
| `ph-build` na `bg`                                                                                                                             | 4,29   | 5,72  |
| `k-easy` na `bg`                                                                                                                               | 3,52   | 4,34  |
| `ph-base` na `bg` — skripta ga meri sa pragom 1,0, tj. namerno ga izuzima od 3:1 (najsvetliji ton faze; faza se nikad ne prikazuje bez naziva) | 2,72   | 3,11  |

Najtanja margina u tabeli teksta: `text-3` na `surface-sel` u svetloj temi, 4,75.

**Šta skripta ne pokriva.** Dodatna jednokratna provera istom formulom (nije u skripti): svi tekstualni tokeni (`text`, `text-2`, `text-3`, `accent-text`, `ok`, `warn`, `bad`) na svim površinama (`bg`, `surface`, `surface-2`, `surface-sel`, `warn-soft`, `bad-soft`) imaju ≥ 4,5:1 u obe teme; najniža vrednost je `text-3` na `bad-soft` u svetloj temi, 4,507:1 (tekst `text-3` se na toj podlozi ne koristi: obaveštenja koriste `text` i `text-2`). Kontrast stvarno iscrtanih ekrana (slika, ne tokeni), grafikona i teksta preko slika nije proveren.

<details>
<summary>Tekst skripte</summary>

```python
import re,sys
css=open('/home/user/sub-19/web/src/styles/tokens.css').read()
def lum(h):
    h=h.lstrip('#'); r,g,b=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    f=lambda c: c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)
def cr(a,b):
    la,lb=lum(a),lum(b);
    if la<lb: la,lb=lb,la
    return (la+0.05)/(lb+0.05)
def tokens(block):
    return dict(re.findall(r'--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})',block))
light=tokens(css.split('@media')[0])
dm=re.search(r"\[data-theme='light'\]\) \{(.*?)\n  \}\n\}",css,re.S).group(1)
dark=tokens(dm)
pairs=[('text','bg',4.5),('text','surface',4.5),('text-2','bg',4.5),('text-2','surface',4.5),('text-3','bg',4.5),('text-3','surface',4.5),('text-3','surface-2',4.5),('text-3','surface-sel',4.5),('text','surface-sel',4.5),('accent-ink','accent',4.5),('accent-text','bg',4.5),('accent-text','surface-sel',4.5),('warn','bg',4.5),('warn','warn-soft',4.5),('bad','bg',4.5),('bad','bad-soft',4.5),('border-ui','bg',3.0),('border-ui','surface',3.0),('focus','bg',3.0),('accent','bg',3.0),('ph-build','bg',3.0),('ph-base','bg',1.0),('k-easy','bg',3.0)]
for name,t in (('SVETLA',light),('TAMNA',dark)):
    print('==',name)
    for a,b,m in pairs:
        if a in t and b in t:
            c=cr(t[a],t[b]); print(f"{a:12s} na {b:12s} {c:5.2f}  {'OK' if c>=m else 'MANJE OD '+str(m)}")
```

Skripta čita tamne tokene iz bloka `@media (prefers-color-scheme: dark)`. Blok za ručni izbor (`:root[data-theme='dark']`) ima iste vrednosti: provereno poređenjem svih 31 tokena u boji (identični).

</details>

---

## 7. Pristupačnost

Automatske provere: `web/e2e/redesign.spec.ts`. Ručni prolaz čitačem ekrana (VoiceOver, TalkBack) i prolaz svih ekrana tastaturom nisu zabeleženi u repozitorijumu: nije proveren.

| Oblast                           | Stanje u kodu                                                                                                                                                                                                                                                                                                                           | Provera                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Jezik                            | `<html lang="sr">`                                                                                                                                                                                                                                                                                                                      | —                                                                  |
| Naslovi                          | tačno jedan h1 po tabu i po ekranu iznad taba, bez preskakanja nivoa (Danas ima h1 samo za čitač ekrana)                                                                                                                                                                                                                                | `redesign.spec.ts`: po jedan test za tabove i za ekrane iznad taba |
| Regioni i uloge                  | `nav` „Glavna navigacija“ + `aria-current="page"`; stranica taba je `section` sa `aria-label`, neaktivna `aria-hidden`; list `role="dialog" aria-modal="true"`, naziv iz prvog naslova u listu; potvrda `alertdialog`; čarobnjak `dialog` „Pravljenje plana“; kapija za prijavu `dialog` „Prijava“; trake `alert` (greška) ili `status` | kod                                                                |
| Oznake                           | segmenti `role="group"` + `aria-pressed`; `‹ ›` imaju „Prethodna nedelja“ / „Sledeća nedelja“; današnji red `aria-current="date"`; veliki brojevi su `aria-hidden` uz tekst za čitač („…, 8 kilometara“); `Bar` i traka ciklusa su `role="img"` sa celom rečenicom; grafikoni `role="group"` sa opisom                                  | kod                                                                |
| Poruke posle unosa               | `Notice` tona greška je `role="alert"`; poruke u formama `role="alert"`; poruka o nemogućem vremenu u čarobnjaku se najavljuje                                                                                                                                                                                                          | kod; `c0720bd`                                                     |
| Fokus                            | prsten 2 px `var(--focus)`, odmak 2 px, samo za tastaturu (`:focus-visible`); ekran pri otvaranju fokusira svoj h1, „Nazad“ vraća fokus na red-otvarač                                                                                                                                                                                  | kod; e2e „fokus: ekran preuzima fokus…“                            |
| List                             | fokus ulazi u list i vraća se na dugme-otvarač; „Tab“ ostaje unutar lista; Escape zatvara; pozadina (`main` i `#tabbar`) dobija `inert`, a gde `inert` ne postoji `aria-hidden` (posle pomeranja fokusa)                                                                                                                                | `web/src/components/ui/Sheet.tsx`, `ui.test.tsx`                   |
| Mete dodira                      | `--touch: 44px`; na 390 px svako dugme, veza, `summary`, polje na svim tabovima i 14 ekrana iznad njih ≥ 44 px u kraćoj dimenziji. Izuzeci (nemaju 44 px): tačke grafikona (prečnik ≈ 30 px: r = 15 u crtežu od 340 jedinica) i delovi mape tela; isti unos bola postoji preko liste „Deo tela“ u listu za unos                         | e2e „mete dodira na telefonu…“ (izuzeci su u komentaru testa)      |
| Bez vodoravnog skrola            | 320, 390, 430, 768, 1024, 1440 px, svetla i tamna tema, svi tabovi i 14 ekrana iznad                                                                                                                                                                                                                                                    | e2e „nijedan ekran ne prelazi širinu prozora“                      |
| Smanjeno kretanje                | `base.css` svodi trajanje animacija i prelaza na 0,001 ms; `Num` odmah pokazuje vrednost; prevlačenje samo menja tab; uvodni ekran se ne prikazuje                                                                                                                                                                                      | e2e „smanjeno kretanje“ (proverava `#tcard`)                       |
| Zumiranje                        | `viewport` ne zabranjuje pinch-zoom; dvostruki dodir ne zumira (`touch-action: manipulation`)                                                                                                                                                                                                                                           | kod                                                                |
| Boja nije jedini signal          | stanje = reč ili ikona; faza = naziv; poreklo podatka = oblik; propušten dan = reč „nije odrađeno“                                                                                                                                                                                                                                      | kod                                                                |
| Traka tabova ne zaklanja sadržaj | poslednji red svakog taba može da se doskroluje iznad trake                                                                                                                                                                                                                                                                             | e2e „traka tabova ne prekriva sadržaj…“                            |
| Kontrast                         | odeljak 6                                                                                                                                                                                                                                                                                                                               | skripta                                                            |

---

## 8. Uklonjeno uz odobrenje

Zapis o odobrenju u repozitorijumu postoji samo za Zajednicu (poruka commit-a `aa4c435`: „UI Zajednice uklonjen (odobreno)“). Ostale stavke 8a navedene su po nalogu za ovaj dokument; ostalo je u 8b.

### 8a. Uz odobrenje

1. **UI Zajednice**: tab, ekran (rang-lista, filteri, profil, poređenje, izazov nedelje), sekcija u Podešavanjima (uključivanje, nadimak), uređivanje izazova (vlasnik), traka „Novo: Zajednica“, testovi `features/community/*`, `e2e/community.spec.ts`. Ostaje (iza prekidača `COMMUNITY_ENABLED = false` u `web/src/services/config.ts`): `web/src/app/community.ts`, `web/src/stores/communityStore.ts`, `web/src/services/community/communityApi.ts`, `web/src/domain/community/`. Aplikacija ne šalje nijedan zahtev ka tabeli zajednice (e2e: „nijedan zahtev ne ide ka tabeli zajednice“). Napomena: komentar uz `COMMUNITY_ENABLED` još kaže da ekran ostaje netaknut iza prekidača; to više ne važi — ekrana nema, pa vraćanje prekidača na `true` ne vraća UI.
2. **Animacija ulaska ekrana** (stanje `entering`, klasa `uskoci`, `ENTERING_MS`, testovi trajanja).
3. **Zaglavlje**: zupčanik i trajna traka ciklusa sa natpisom. Funkcije su premeštene (odeljak 2.2).
4. **Duple kartice**: pet kartica forme u Trci (ostaje jedan ekran Forma i predikcija); HRV, san, svežina i puls u miru ponovljeni u više kartica (ostaju brojke u „Stanju danas“ + grafikoni); „Poslednjih 14 dana“ i „Istorija bola“ (jedna istorija); „Gde sam u planu“ i „Do sada“ (dva sažetka istog); list dana i kartice na Danas (jedan ekran Detalji treninga).

### 8b. Uklonjeno, odobrenje nije proveren

Nema zapisa o odobrenju. Računice ostaju u domenu; nestao je samo prikaz.

1. Serija bez propusta („N dana po planu“, „serija bez propusta“) sa Danas. `streak` i `lastSevenDays` nisu više u `useTodayModel`.
2. Grafikon „Tempo svakog trčanja“. Komponenta `PaceChart` ostaje u `web/src/features/race/charts.tsx`, model `pace` se računa u `useFormModel`, ali se nigde ne prikazuje.
3. „km nedeljno“ (prosek završenih nedelja) i „ostalo“ (km do kraja plana) iz sažetaka plana (`planSummary` ih i dalje računa).
4. Lista „Završeno · N“ po danima i „Sledeće“ sa do tri treninga na Danas (sada zbir km i jedan red).
5. Zbirni vrh Podešavanja („… stvari čekaju“ / „Sve je povezano“) i izbor grupa (Nalog / Trening / Veze / App / Admin).

---

## 9. Datoteke

Testovi stoje uz kod (`*.test.ts`, `*.test.tsx`); e2e u `web/e2e/` (`navigation.spec.ts`, `redesign.spec.ts` i specifikacije po funkciji).

| Putanja                                                      | Sadržaj                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web/src/app/`                                               | `App.tsx` ljuska (tabovi, ekrani, list, skrol, adrese); `tabs.ts` aliasi i adrese; `navHistory.ts` istorija slojeva; `useSwipeNav.ts` prevlačenje; `useSystemBanners.ts`; `createApp.ts`; `community.ts` (iza prekidača)                                                                     |
| `web/src/components/ui/`                                     | `primitives.tsx` (Section, Row, Notice, Facts, Bar), `Shell.tsx` (AppBar, ScreenFrame, Tabbar, Page, AuthGate), `Sheet.tsx`, `ConfirmHost.tsx`, `BannerHost.tsx`, `Badge.tsx`, `Disclosure.tsx` (Disclosure, Help), `Num.tsx`, `SessionProfile.tsx`, `icons.tsx`, `phase.ts`                 |
| `web/src/features/registry.tsx`, `screens.tsx`, `sheets.tsx` | registri: tabovi, ekrani iznad taba, listovi                                                                                                                                                                                                                                                 |
| `web/src/features/today/`                                    | Danas: `index.tsx`, `TodayHero.tsx`, `Advisories.tsx`; zajedničko za Detalje: `EntryForm.tsx`, `DayEntry.tsx`, `Cards.tsx` (Sa sata, Po zonama, Jutros, poređenje), `AiCard.tsx`, `WeatherCard.tsx`, `WorkSegment.tsx`                                                                       |
| `web/src/features/day/`                                      | `DayScreen.tsx` — Detalji treninga                                                                                                                                                                                                                                                           |
| `web/src/features/plan/`                                     | `index.tsx` nedelja; `DayRow.tsx`; `PlanOverview.tsx` (Cela priprema); `AdjustPlan.tsx`; `planActions.ts`; `useAdjustments.ts`; `WeekRow.tsx`, `WeekBody.tsx`, `WeekChart.tsx`; listovi `AltSheet.tsx`, `SwapSheet.tsx`                                                                      |
| `web/src/features/progress/`                                 | `index.tsx` Napredak; `ActivitiesScreen.tsx`; `model.ts`                                                                                                                                                                                                                                     |
| `web/src/features/race/`                                     | `FormScreen.tsx`; `RaceAnalysis.tsx`; `useFormModel.ts`; `T3kSheet.tsx`; `Journey.tsx`, `charts.tsx`, `TrendAi.tsx`, `RaceData.tsx`                                                                                                                                                          |
| `web/src/features/recovery/`                                 | `OporavakScreen.tsx`, `BolScreen.tsx`, `MasaScreen.tsx`; `useRecoveryModel.ts`; `ReadinessCard.tsx`, `cards.tsx`, `WeightCard.tsx`, `BodyMap.tsx`, `charts.tsx`; list `KneeSheet.tsx` (unos bola)                                                                                            |
| `web/src/features/ti/`                                       | `index.tsx` tab Ti; `screens.tsx` svi ekrani taba; `profileModel.ts`; sekcije `accountSection.tsx`, `dataSection.tsx`, `stravaSection.tsx`, `icuSections.tsx`, `weatherSection.tsx`, `pushSection.tsx`, `adminSections.tsx`, `AppRefresh.tsx`; listovi `AccountSheets.tsx`, `UsersSheet.tsx` |
| `web/src/features/session/`, `cycle/`, `onboarding/`         | model sesije i delovi Detalja (`WorkoutParts.tsx`); model ciklusa i `CycleRail.tsx`; čarobnjak (koraci i logika isti, u TSX-u izmenjeno nekoliko redova; stilovi napisani iznova u `styles/wizard.css`)                                                                                      |
| `web/src/lib/`                                               | `theme.ts`, `useTheme.ts` (tema); `copy.ts` (putevi u porukama); `dates.ts` (nazivi dana)                                                                                                                                                                                                    |
| `web/src/styles/`                                            | `tokens.css` · `base.css` · `ui.css` · `shell.css` · `screens.css` · `charts.css` · `wizard.css`; `fonts/` Figtree                                                                                                                                                                           |
| `web/public/`                                                | `tema.js` (tema pre iscrtavanja), `manifest.json`, ikone `icon-*.png`, `apple-touch-icon.png`, `badge-96.png`                                                                                                                                                                                |
| `docs/brand/`                                                | `logo-sub20.png` (izvor); `build-icons-from-logo.py` pravi PWA ikone u `web/public/`                                                                                                                                                                                                         |
| `docs/redesign/`                                             | ovaj dokument; `README.md` i `concept-lab*`, `lab/` su istorija prethodnog pravca                                                                                                                                                                                                            |

---

## 10. Poznata ograničenja i nezavršeno

1. **Android APK/TWA nije ponovo pravljen ovde.** Ikone i naziv u paketu iz prodavnice ostaju stari dok se paket ne napravi ponovo prema `docs/ANDROID_TWA.md`. (`web/public/sub20.apk` je poslednji put menjan u commit-u `7052b99`, pre redizajna.)
2. **Nije bilo testiranja sa stvarnim korisnicima.** Putanje u odeljku 2.3 su sopstvena provera.
3. **Domenski tekstovi koji pominju stare puteve prepisuju se pri prikazu** u `web/src/lib/copy.ts`, jer su domenski tekstovi zamrznuti oracle testovima. Pokriveni su tačno tri izraza: „Podešavanja → Tvoje zone pulsa“, „spiska u Podešavanjima“, „Podešavanja → intervals.icu →“. Primenjuje se u `ZonesCard` (`web/src/features/today/Cards.tsx`).
4. **Nekorišćeni pomoćnici domena ostaju** u `web/src/domain/settings`: `SETTINGS_GROUPS`, `groupForSection`, `settingsHero`, `waitingText` (stari zbirni status u Podešavanjima) i `ANNOUNCEMENT`, `announcementToShow` (objava „Novo: Zajednica“). Koriste ih samo oracle testovi; u aplikaciji ih niko ne poziva.
5. **Rezultati provere** (popunjava se naknadno):

<!-- PROVERA -->

Izmereno 2026-10-09, na grani `claude/quiet-athlete`, posle poslednje izmene koda:

| Provera                                                             | Rezultat                                                                                                                                  |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check` (tsc, eslint, prettier, vitest)                     | prolazi: 120 fajlova, 1237 testova                                                                                                        |
| `npm run build`                                                     | prolazi (glavni paket ≈ 566 kB, Vite upozorava na > 500 kB)                                                                               |
| Playwright e2e (`npx playwright test`)                              | 64/64 prolazi                                                                                                                             |
| Screenshotovi u svetloj i tamnoj temi (390, 320, 430, 820, 1440 px) | pravljeni i pregledani samo delimično: 390 px svi glavni ekrani i listovi, 320 i 1440 px Danas, Plan, Forma; 430 i 820 px nisu pregledani |
| Horizontalni skrol 320–1440 px, svi tabovi i ekrani, obe teme       | proverava `e2e/redesign.spec.ts` (prolazi)                                                                                                |
| Mete dodira ≥ 44 px, 390 px, svi tabovi i ekrani                    | proverava `e2e/redesign.spec.ts` (prolazi)                                                                                                |

**Parnost starog i novog UI-ja (audit).** Pregledano svih pet oblasti (Danas/Detalji, Plan, Napredak, Ti, ljuska/PWA/čarobnjak). Nalazi prve četiri oblasti proveravani su samo delimično (verifikacija je prekinuta limitom sesije); nalaz ljuske je potvrdio nezavisni skeptik. Popravljeno posle audita: grafik tempa svakog trčanja (bio nedostupan), struktura sesije u redu dana, kiša i hladniji sat u redu o vremenu, datum poslednjeg backupa, upozorenje o nedostupnom skladištu na Danas, tekst za generisan plan bez polaznih podataka, kontekst prijave problema, reset steka posle odjave, linkovi ka uputstvu i politici u novoj kartici, putevi u `privacy.html`. Iz audita ljuske: sistemske trake (oštećen zapis, sukob, nova verzija) bile su ispod čarobnjaka i nisu mogle da se pritisnu (ispravljeno, `e2e/banners.spec.ts`); Escape zatvara ekran iznad taba; čarobnjak zatvara ekrane ispod sebe; odloženi upis se završava pri zatvaranju ekrana i promeni taba, nikad iza kapije za prijavu; ekran u učitavanju ima traku „Nazad“.

**Poznate razlike koje nisu popravljene** (nalazi audita, nisu pojedinačno potvrđeni):

- Posle „Završi trening“ Danas pokazuje samo red „Odrađeno · km · vreme · tempo“; unos, izvor (Strava/ručno) i analiza su u Detaljima treninga, jedan dodir dalje.
- Jutarnji zapis stariji od jednog dana u „Stanju danas“ pokazuje „Star zapis“ i datum, ali ne i vrednosti.
- „Gde sam u planu“ više ne pokazuje prosek km nedeljno ni „ostalo“ (km i nedelje do kraja); oznaka vrste plana („generisan plan · 12 nedelja“) nije prikazana.
- Serija bez propusta i lista „Sledeće“ (do 3 treninga) su uklonjene (v. odeljak 8).
- Zamrznuti domenski tekstovi koji pominju „SUB-20“ kao ime aplikacije u podešavanjima telefona nisu menjani.
